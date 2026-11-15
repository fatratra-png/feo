import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

/** Labelled text input with inline error/hint; password fields get a show/hide toggle. */
export function Field({
  id, label, type = 'text', value, onChange, autoComplete, error, hint,
}: {
  id: string; label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete: string; error?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="h-12 w-full rounded-xl border border-line-strong bg-fg/[0.04] px-4 text-base outline-none transition focus:border-accent aria-[invalid=true]:border-danger"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-fg-3 hover:text-fg">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-3">{hint}</p> : null}
    </div>
  );
}
