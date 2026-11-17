# Teste de ponta a ponta do app montado (pasta dist), com um Supabase falso. Uso: python3 tests/smoke.py
import asyncio, json, os, sys
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); DIST=os.path.join(HERE,'..','dist')
fails=[]
def check(name,cond,extra=''):
    print(('ok   ' if cond else 'FAIL ')+name,extra)
    if not cond: fails.append(name)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='pt-BR')
        await ctx.add_init_script(open(os.path.join(HERE,'mock.js')).read()+"\nwindow.__LANTERNINHA_TEST_CLIENT__=window.supabase.createClient();")
        pg=await ctx.new_page(); pg.set_default_timeout(8000); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.on('console',lambda m:errs.append('console: '+m.text) if m.type=='error' and '404' not in m.text else None)
        async def h(route):
            u=route.request.url
            if '/api/img' in u or 'image.tmdb.org' in u: return await route.fulfill(path=os.path.join(HERE,'pb.jpg' if 'blue' in u else 'p5.jpg'),content_type='image/jpeg')
            if '/api/search' in u: return await route.fulfill(json={'results':[{'id':77,'title':'Coraline','original':'Coraline','year':'2009','poster':'/blue77.jpg'}]})
            if '/api/ratings' in u: return await route.fulfill(json={'imdbId':'tt0327597','tmdb':7.8,'imdb':7.7,'rt':90,'mc':80})
            if '/api/images' in u: return await route.fulfill(json={'backdrops':['/blueback1.jpg','/blueback2.jpg']})
            if '/api/discover' in u: return await route.fulfill(json={'results':[]})
            if '/api/movie' in u: return await route.fulfill(json={'overview':'Sinopse do filme.','runtime':100,'genres':['Animação'],'director':'Henry Selick','backdrop':'/blueback.jpg','cast':['Dakota Fanning'],'trailer':'abc123XYZ_-','providers':{'stream':[{'name':'Netflix','logo':''}],'rent':[],'buy':[]}})
            if 'app.test' not in u: return await route.fulfill(status=404,body='')
            path=u.split('app.test')[1].split('?')[0]; path='/index.html' if path=='/' else path
            f=DIST+path
            await (route.fulfill(path=f) if os.path.exists(f) else route.fulfill(status=404,body=''))
        await pg.route('**/*',h)
        L=lambda: pg.evaluate("JSON.parse(localStorage.notaFilmeV2||'[]').map(x=>x.t+':'+(x.st||x.s)+(x.by?':by '+x.by:''))")
        tab=lambda v: pg.click('.tab[data-v=%s]'%v)
        async def signup(un,em,films):
            await pg.evaluate("s=>localStorage.setItem('notaFilmeV2',s)",json.dumps(films)); await pg.reload()
            await tab('prof'); await pg.wait_for_selector('#af'); await pg.click('.seg button[data-m=up]'); await pg.wait_for_selector('#un')
            await pg.fill('#un',un); await pg.fill('#em',em); await pg.fill('#pw','123456'); await pg.click('#ago'); await pg.wait_for_selector('#fadd'); await pg.wait_for_timeout(900)
        async def logout():
            await tab('prof'); await pg.click('#cfg'); await pg.wait_for_selector('#sout'); await pg.click('#sout'); await pg.click('#sout'); await pg.wait_for_selector('#af'); await pg.wait_for_timeout(300)
        async def login(em):
            await pg.fill('#em',em); await pg.fill('#pw','123456'); await pg.click('#ago'); await pg.wait_for_selector('#fadd'); await pg.wait_for_timeout(1000)
        async def quiz(n_expected=None):
            n=0
            while await pg.locator('#num').count()==0:
                await pg.wait_for_selector('.opt'); await pg.click('.opt >> nth=0'); await pg.wait_for_timeout(420); n+=1
                if n>14: break
            return n

        await pg.goto('http://app.test/'); await pg.wait_for_selector('#t')
        check('abas na ordem certa',(await pg.locator('.tab').all_inner_texts())==['Avaliar','Início','Meus filmes','Perfil'])
        check('começa na aba Avaliar com campo vazio',await pg.input_value('#t')=='')
        # avaliar sem nome
        await pg.click('#go'); check('pede o nome do filme',await pg.locator('#t.need').count()==1)
        # busca + avaliação
        await pg.fill('#t','coral'); await pg.wait_for_selector('.sri'); await pg.click('.sri'); await pg.click('#go')
        await pg.wait_for_selector('.opt'); check('barra de progresso aparece',await pg.locator('#bar:not(.hide)').count()==1)
        await pg.click('.opt >> nth=0'); await pg.wait_for_timeout(420); await pg.click('#back'); await pg.wait_for_timeout(200)
        check('voltar retorna à pergunta anterior, com a resposta marcada',await pg.locator('.opt.on').count()==1)
        n=await quiz(); await pg.wait_for_timeout(2600)
        check('7 perguntas até o resultado',n==7,str(n)); check('nota máxima 5',await pg.inner_text('#num')=='5',await pg.inner_text('#num'))
        check('salvou',await L()==['Coraline:5'],str(await L()))
        await pg.click('#minus'); check('ajuste de meia estrela',await pg.inner_text('#num')=='4,5' and await L()==['Coraline:4.5'])
        await pg.screenshot(path=os.path.join(HERE,'out-result.png'))
        # review
        await pg.click('#rvb'); await pg.wait_for_selector('#rt'); await pg.fill('#rt','Linha um\nLinha dois'); await pg.click('#rs'); await pg.wait_for_timeout(200)
        check('review salva e mostrada no botão','Linha um' in await pg.inner_text('#rvb'))
        # compartilhar
        await pg.click('#shr'); await pg.wait_for_selector('.shr .pv img'); check('imagem de compartilhar gerada',True)
        await pg.click('.shr button[data-f="1"]'); await pg.wait_for_timeout(700); check('formato story gera',await pg.locator('.shr .pv img').count()==1 and await pg.inner_text('#shm')=='')
        await pg.click('.shr .x')
        # voltar do resultado desfaz
        await pg.click('#back'); await pg.wait_for_selector('.opt'); check('voltar do resultado desfaz a nota',await L()==[],str(await L()))
        await pg.click('.opt >> nth=2'); await pg.wait_for_timeout(2600); await pg.wait_for_selector('#num'); print('   nota refeita:',await pg.inner_text('#num'))
        await pg.click('#again'); await pg.wait_for_selector('#t'); check('avaliar outro limpa o campo',await pg.input_value('#t')=='')
        check('recentes na aba Avaliar',await pg.locator('.rc').count()==1)
        # página do filme
        await pg.click('.rc'); await pg.wait_for_selector('.mybox .rate'); await pg.wait_for_selector('#trl')
        check('página do filme: sobre + onde assistir','Sinopse do filme.' in await pg.inner_text('.about') and 'Netflix' in await pg.inner_text('.prov'))
        check('fundo tingido',await pg.evaluate("document.body.classList.contains('tinted')"))
        await pg.screenshot(path=os.path.join(HERE,'out-film.png'),full_page=True)
        await pg.click('#back'); await pg.wait_for_selector('#t'); check('saiu da página: tinta removida',not await pg.evaluate("document.body.classList.contains('tinted')"))
        # estados
        await pg.fill('#t','Filme digitado'); await pg.click('#bseen'); await pg.wait_for_selector('.state'); check('já vi',(await L())[0]=='Filme digitado:seen',str(await L()))
        await pg.click('#back'); await tab('lib'); await pg.wait_for_selector('.grid')
        check('visto sem nota aparece em Assistidos',(await pg.inner_text('.seg button[data-t=watched]')).endswith('2') and 'sem nota' in await pg.inner_text('#lbody'))
        await pg.click('button[data-n="-1"]'); await pg.wait_for_timeout(200); check('filtro sem nota',await pg.locator('#lbody .fc').count()==1)
        await pg.click('button[data-n="0"]'); await pg.click('.fc >> nth=0'); await pg.wait_for_selector('.state')
        await pg.click('#adel'); await pg.click('#adel'); await pg.wait_for_selector('#lbody'); await tab('rate'); await pg.wait_for_selector('#t'); check('tirar da lista',len(await L())==1)
        # contas e amigos
        bia=[{'t':'Filme %d'%i,'s':[5,4,3,2.5,1.5,4.5][i],'c':False,'id':100+i,'img':'/blue%d.jpg'%i,'note':'Review da Bia' if i==0 else None,'d':'2026-10-0%d'%(i+1)} for i in range(6)]
        for f in bia:
            if f['note'] is None: del f['note']
        await signup('bia','b@x.com',bia); await logout()
        await signup('vini','a@x.com',[{'t':'Truman','s':3.5,'c':False,'id':10,'img':'/red.jpg','d':'2026-11-02'},{'t':'Filme 0','s':4,'c':False,'id':100,'img':'/blue0.jpg','d':'2026-09-02'}])
        await pg.click('#fadd'); await pg.fill('#aq','@bia'); await pg.click('#afm button'); await pg.wait_for_selector('#arq'); await pg.click('#arq'); await pg.wait_for_timeout(500)
        check('pedido enviado','Pedido enviado' in await pg.inner_text('#ar')); await pg.click('#ax')
        await logout(); await login('b@x.com'); await pg.wait_for_selector('[data-ok]'); await pg.click('[data-ok]'); await pg.wait_for_timeout(800)
        check('amizade aceita',await pg.locator('.frs button.fr').count()==1)
        # indicar
        await tab('lib'); await pg.wait_for_selector('.grid'); check('diário agrupa por mês','outubro de 2026' in (await pg.inner_text('.mhead >> nth=0')).lower())
        await pg.click('button[data-s=nota]'); await pg.wait_for_timeout(200); check('ordenar por maior nota',(await pg.inner_text('.fc >> nth=0')).strip().endswith('5'))
        await pg.click('button[data-n="4"]'); await pg.wait_for_timeout(200); check('filtro por estrela',await pg.locator('.fc').count()==2,str(await pg.locator('.fc').count()))
        await pg.click('button[data-n="0"]'); await pg.click('.fc >> nth=1'); await pg.wait_for_selector('#arec'); await pg.click('#arec'); await pg.wait_for_selector('#rok')
        check('amigo único já vem marcado',await pg.locator('.fr.sel').count()==1); await pg.fill('#rnote','vê esse'); await pg.click('#rok'); await pg.wait_for_timeout(1300)
        check('indicação fecha sozinha',await pg.locator('#rok').count()==0)
        await pg.click('#back'); await logout(); await login('a@x.com')
        check('bolinha de indicação na aba',await pg.locator('.tab[data-v=lib] .dot').count()==1)
        await tab('home'); await pg.wait_for_selector('.hcard'); check('Início mostra a indicação','1 indicação' in await pg.inner_text('.hcard'))
        await pg.wait_for_timeout(700); await pg.screenshot(path=os.path.join(HERE,'out-inicio.png'),full_page=True)
        await tab('lib'); await pg.click('.seg button[data-t=want]'); await pg.wait_for_selector('.rcd'); await pg.click('[data-ra]'); await pg.wait_for_timeout(600)
        check('aceitar indicação vai pra fila','Filme 1:want:by bia' in await L() or any('want:by' in x for x in await L()),str(await L()))
        # nota da galera + reviews
        await pg.click('.seg button[data-t=watched]'); await pg.wait_for_timeout(200); await pg.click('.fc >> nth=1'); await pg.wait_for_selector('#crowd .fr')
        await pg.wait_for_selector('.scores .lt'); txt=await pg.inner_text('#scores'); check('notas em destaque','Lanterninha' in txt and 'IMDb' in txt and 'Tomatômetro' in txt and 'Metacritic' in txt, txt.replace(chr(10),' '))
        check('nota da galera só com estrelas',await pg.locator('#crowd .fr .stars').count()==1 and 'Review da Bia' not in await pg.inner_text('#crowd'))
        await pg.click('#crowd .fr'); await pg.wait_for_selector('.rvc.hl'); check('tela de reviews com a review do amigo','Review da Bia' in await pg.inner_text('.rvc.hl') and await pg.locator('#vfilm').count()==0)
        await pg.wait_for_timeout(700); await pg.screenshot(path=os.path.join(HERE,'out-reviews.png')); await pg.click('#vx'); await pg.click('#back')
        # perfil do amigo + palpite
        await tab('prof'); await pg.click('.frs button.fr'); await pg.wait_for_selector('#gplay'); check('perfil do amigo lista filmes',await pg.locator('#ffilms .fc').count()==6)
        check('contagem de amigos',await pg.inner_text('#fcount')=='1 amigo',await pg.inner_text('#fcount'))
        await pg.click('#gplay'); await pg.wait_for_selector('#gok'); await pg.click('#gp'); check('palpite ajusta',await pg.inner_text('#gnum')=='3,5')
        for i in range(5):
            await pg.click('#gok'); await pg.wait_for_timeout(350); await pg.click('#gok'); await pg.wait_for_timeout(200)
        await pg.wait_for_selector('#gend'); pts=await pg.inner_text('.gs .num'); await pg.click('#gend'); print('   pontos:',pts)
        await pg.click('#back'); await pg.wait_for_selector('#board .fr'); check('placar aparece',pts+' pts' in await pg.inner_text('#board'),await pg.inner_text('#board'))
        # editar perfil
        await pg.click('#ped'); await pg.fill('#edn','Vinícius'); await pg.fill('#ebio','Minha bio'); await pg.click('#et4 button >> nth=0'); await pg.wait_for_selector('#px'); await pg.click('.ov .fc >> nth=0'); await pg.wait_for_timeout(200)
        await pg.click('#ebn'); await pg.wait_for_selector('#bq'); await pg.click('.ov >> nth=1 >> .fc >> nth=0'); await pg.wait_for_selector('.scenes button'); await pg.click('.scenes button >> nth=1'); await pg.wait_for_timeout(200)
        check('banner escolhido',await pg.locator('#ebn.has').count()==1)
        check('favorito escolhido',await pg.locator('#et4 button.has').count()==1); await pg.click('#eok'); await pg.wait_for_timeout(700)
        check('banner aparece no perfil',await pg.locator('.pbanner').count()==1 and 'blueback2' in (await pg.get_attribute('.pbanner','style')))
        check('perfil salvo','Vinícius' in await pg.inner_text('.pf') and 'Minha bio' in await pg.inner_text('.bio') and await pg.locator('#t4 button.has').count()==1)
        await pg.click('#t4 button.has'); await pg.wait_for_selector('.fhead'); check('top 4 abre o filme',True); await pg.click('#back')
        # sincronização entre aparelhos
        await pg.wait_for_timeout(1200); before=sorted(await L()); await pg.evaluate("localStorage.removeItem('notaFilmeV2');localStorage.removeItem('lantSynced')"); await pg.reload(); await pg.wait_for_timeout(1800)
        check('filmes voltam da conta (sem importar os do amigo)',sorted(await L())==before,str(await L())+' vs '+str(before))
        await tab('prof'); await pg.wait_for_selector('#ped'); await pg.wait_for_timeout(700); await pg.screenshot(path=os.path.join(HERE,'out-perfil.png'))
        check('perfil não mostra o e-mail','a@x.com' not in await pg.inner_text('#stage'))
        await pg.click('#cfg'); await pg.wait_for_selector('#cfmail'); check('e-mail fica nas configurações',await pg.inner_text('#cfmail')=='a@x.com'); await pg.wait_for_timeout(500); await pg.screenshot(path=os.path.join(HERE,'out-config.png'),full_page=True); await pg.click('#cfx')
        # computador
        await pg.set_viewport_size({'width':1280,'height':800}); await tab('lib'); await pg.wait_for_timeout(500); await pg.screenshot(path=os.path.join(HERE,'out-desktop.png'))
        check('sem erros no navegador',not errs,str(errs[:5]))
        await b.close()
    print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)
asyncio.run(main())
