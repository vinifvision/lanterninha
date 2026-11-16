import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../lib/backup';

/** Exportar e importar a lista de filmes em um arquivo. */
export function Backup() {
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="bk">
      <h3>Backup</h3>
      <div>
        <button id="exp" onClick={async () => setMsg(await exportBackup())}>Exportar</button>
        <button id="imp" onClick={() => file.current?.click()}>Importar</button>
      </div>
      <p id="bkmsg">{msg}</p>
      <input
        ref={file} type="file" id="impf" accept=".json,application/json" hidden
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setMsg(await importBackup(f)); }}
      />
    </div>
  );
}
