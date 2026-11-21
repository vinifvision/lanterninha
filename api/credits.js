// Função do servidor (Vercel). Recebe ?id=123 e devolve elenco e equipe do filme, com fotos, para a tela de créditos.
const KEY_ROLES = [
  // [cargo no TMDB, como aparece no app]: a ordem aqui é a ordem dos destaques
  ['Director', 'Direção'],
  ['Screenplay', 'Roteiro'], ['Writer', 'Roteiro'],
  ['Director of Photography', 'Direção de fotografia'],
  ['Editor', 'Montagem'],
  ['Original Music Composer', 'Trilha sonora'], ['Music', 'Trilha sonora'],
  ['Production Design', 'Design de produção'],
  ['Costume Design', 'Figurino'],
  ['Producer', 'Produção'],
];
const DEPTS = {
  Directing: 'Direção', Writing: 'Roteiro', Production: 'Produção', Camera: 'Fotografia', Editing: 'Montagem',
  Sound: 'Som e música', Art: 'Arte', 'Costume & Make-Up': 'Figurino e maquiagem', 'Visual Effects': 'Efeitos visuais',
  Lighting: 'Iluminação', Crew: 'Equipe',
};
const DEPT_ORDER = Object.keys(DEPTS);
const JOBS = {
  Director: 'Direção', 'Assistant Director': 'Assistente de direção', 'First Assistant Director': '1º assistente de direção',
  Screenplay: 'Roteiro', Writer: 'Roteiro', Story: 'Argumento', Novel: 'Romance original', Characters: 'Personagens',
  Producer: 'Produção', 'Executive Producer': 'Produção executiva', 'Co-Producer': 'Coprodução', 'Associate Producer': 'Produção associada',
  'Line Producer': 'Produção de linha', Casting: 'Seleção de elenco',
  'Director of Photography': 'Direção de fotografia', 'Camera Operator': 'Operação de câmera', 'Steadicam Operator': 'Steadicam',
  'Still Photographer': 'Fotografia de cena', Gaffer: 'Chefe de elétrica',
  Editor: 'Montagem', Colorist: 'Colorização',
  'Original Music Composer': 'Trilha sonora', Music: 'Música', 'Music Supervisor': 'Supervisão musical',
  'Sound Designer': 'Desenho de som', 'Sound Mixer': 'Mixagem de som', 'Supervising Sound Editor': 'Supervisão de edição de som',
  'Production Design': 'Design de produção', 'Art Direction': 'Direção de arte', 'Set Decoration': 'Cenografia',
  'Costume Design': 'Figurino', 'Makeup Artist': 'Maquiagem', 'Hair Designer': 'Cabelo', 'Makeup Department Head': 'Chefe de maquiagem',
  'Visual Effects Supervisor': 'Supervisão de efeitos visuais', 'Stunt Coordinator': 'Coordenação de dublês',
};

export default {
  async fetch(request) {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^\d{1,9}$/.test(id)) return Response.json({ error: 'id inválido' }, { status: 400 });

    const key = process.env.TMDB_KEY;
    if (!key) return Response.json({ error: 'TMDB_KEY não configurada' }, { status: 500 });

    const r = await fetch('https://api.themoviedb.org/3/movie/' + id + '/credits?language=pt-BR&api_key=' + encodeURIComponent(key));
    if (!r.ok) return Response.json({ error: 'Falha ao consultar o TMDB' }, { status: r.status === 404 ? 404 : 502 });
    const c = await r.json();
    const crew = c.crew || [];

    // Destaques: quem criou o filme. A mesma pessoa em vários cargos vira um cartão só ("Direção e roteiro").
    const keyPeople = [];
    for (const [job, label] of KEY_ROLES) {
      const people = crew.filter((p) => p.job === job).slice(0, label === 'Produção' ? 2 : 3);
      for (const p of people) {
        const same = keyPeople.find((k) => k.id === p.id);
        if (same) { if (!same.roles.includes(label)) same.roles.push(label); continue; }
        keyPeople.push({ id: p.id, name: p.name, photo: p.profile_path || '', roles: [label] });
      }
    }

    const cast = (c.cast || []).slice(0, 24).map((p) => ({ id: p.id, name: p.name, character: p.character || '', photo: p.profile_path || '' }));

    // Ficha técnica completa, por departamento
    const depts = DEPT_ORDER.map((d) => {
      const seen = new Set();
      const people = crew.filter((p) => p.department === d).filter((p) => {
        const k = p.id + '|' + p.job; if (seen.has(k)) return false; seen.add(k); return true;
      }).slice(0, 14).map((p) => ({ id: p.id, job: JOBS[p.job] || p.job, name: p.name }));
      return { name: DEPTS[d], people };
    }).filter((d) => d.people.length);

    return Response.json({
      key: keyPeople.slice(0, 10).map(({ id, name, photo, roles }) => ({ id, name, photo, role: roles.join(' e ') })),
      cast,
      depts,
    }, { headers: { 'Cache-Control': 'public, s-maxage=604800' } });
  },
};
