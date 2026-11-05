export const ERROR_TOAST_EVENT = 'stockpilot:error-toast';

export type ToastTone = 'error' | 'success';

export function notifyToast(message: string, tone: ToastTone) {
    if (!message.trim() || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(ERROR_TOAST_EVENT, { detail: { message, tone } }));
}

export function notifyErrorToast(message: string) {
    notifyToast(message, 'error');
}

export function notifySuccessToast(message: string) {
    notifyToast(message, 'success');
}