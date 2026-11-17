# Tira fotos das telas simulando um celular Android (com área da barra de status). Uso: python3 tests/shots.py
import asyncio, json, os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); DIST=os.path.join(HERE,'..','dist')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='pt-BR',has_touch=True,is_mobile=True)
        await ctx.add_init_script(open(os.path.join(HERE,'mock.js')).read()+"\nwindow.__LANTERNINHA_TEST_CLIENT__=window.supabase.createClient();")
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        async def h(route):
            u=route.request.url
            if '/api/img' in u or 'image.tmdb.org' in u: return await route.fulfill(path=os.path.join(HERE,'pb.jpg' if 'blue' in u else 'p5.jpg'),content_type='image/jpeg')
            if '/api/movie' in u: return await route.fulfill(json={'overview':'Sinopse do filme. '*12,'runtime':100,'genres':['Drama'],'director':'Fulano','backdrop':'/back.jpg','cast':['A','B'],'trailer':'abc123XYZ_-','providers':{'stream':[{'name':'Netflix','logo':''}],'rent':[],'buy':[]}})
            if 'app.test' not in u: return await route.fulfill(status=404,body='')
            path=u.split('app.test')[1].split('?')[0]; path='/index.html' if path=='/' else path
            f=DIST+path
            await (route.fulfill(path=f) if os.path.exists(f) else route.fulfill(status=404,body=''))
        await pg.route('**/*',h)
        films=[{'t':'Filme %d'%i,'s':[5,4,3,2.5,1.5,4.5][i%6],'c':False,'id':100+i,'img':'/%s%d.jpg'%('blue' if i%2 else 'red',i),'d':'2026-%02d-0%d'%(11-i//6,i%6+1),'ts':1000-i} for i in range(30)]
        await pg.goto('http://app.test/'); await pg.evaluate("s=>localStorage.setItem('notaFilmeV2',s)",json.dumps(films)); await pg.reload()
        await pg.add_style_tag(content=':root{--safe-area-inset-top:36px;--safe-area-inset-bottom:20px}')
        shot=lambda n: pg.screenshot(path=os.path.join(HERE,'shot-%s.png'%n))
        await pg.wait_for_timeout(700); await shot('1-avaliar')
        await pg.click('.tab[data-v=lib]'); await pg.wait_for_timeout(700); await shot('2-filmes')
        await pg.evaluate("document.getElementById('scroller').scrollTop=900"); await pg.wait_for_timeout(500); await shot('3-filmes-rolado')
        await pg.click('.fc >> nth=8'); await pg.wait_for_timeout(1200); await shot('4-filme')
        await pg.evaluate("document.getElementById('scroller').scrollTop=500"); await pg.wait_for_timeout(500); await shot('5-filme-rolado')
        await pg.click('#back'); await pg.wait_for_timeout(600); print('volta para o mesmo ponto:',await pg.evaluate("document.getElementById('scroller').scrollTop"))
        await pg.click('.tab[data-v=home]'); await pg.wait_for_timeout(700); await shot('6-inicio')
        await pg.click('.tab[data-v=rate]'); await pg.fill('#t','Teste'); await pg.click('#go'); await pg.wait_for_timeout(700); await shot('7-pergunta')
        print('erros:',errs); await b.close()
asyncio.run(main())
