export default function LogoMark({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
            <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
                <path d="M32 7 52 18.5v25L32 56 12 43.5v-25L32 7Z" />
                <path d="m12.5 18.8 19.5 11.5 19.5-11.5M32 30.3V55" />
                <path d="M35 43l4.5-4.5 3.5 1.5 5-6" />
                <path d="M44.5 34H48v3.5" />
            </g>
        </svg>
    );
}