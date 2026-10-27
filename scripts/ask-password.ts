let pipedLines: string[] | null = null;

/** Reads the whole piped input once, then hands out one line per prompt. */
async function nextPipedLine(): Promise<string> {
  if (!pipedLines) {
    const input = await new Promise<string>((resolve) => {
      let collected = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => { collected += chunk; });
      process.stdin.once('end', () => resolve(collected));
    });
    pipedLines = input.split(/\r?\n/);
  }
  return (pipedLines.shift() ?? '').trimEnd();
}

/**
 * Shows a star per character so the password stays out of shell history and `ps` output.
 * Without a terminal (`docker compose exec -T`) the whole input is read once and handed out line by line.
 */
export function askPassword(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    return nextPipedLine();
  }

  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    let value = '';
    let skipKeySequence = 0;
    const stop = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (skipKeySequence > 0) { skipKeySequence -= 1; continue; }
        if (character === '\u001b') { skipKeySequence = 2; continue; }
        if (character === '\u0003') { stop(); process.stdout.write('\n'); reject(new Error('Cancelled.')); return; }
        if (character === '\r' || character === '\n') { stop(); process.stdout.write('\n'); resolve(value); return; }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
          continue;
        }
        if (character < ' ') continue;
        value += character;
        process.stdout.write('*');
      }
    };
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.on('data', onData);
  });
}
