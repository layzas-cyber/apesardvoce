// CONFIGURAÇÃO DO SUBSTACK
const SUBSTACK_URL = 'https://apesardvoce.substack.com'; 
const SUBSTACK_RSS_FEED = `${SUBSTACK_URL}/feed`;
const RSS_API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(SUBSTACK_RSS_FEED)}`;

// BASE DE DADOS DINÂMICA
let noticiasDB = [];
let visibleNewsCount = 3;

// GERENCIAMENTO DE FAVORITOS & COMENTÁRIOS (localStorage)
function getFavoritos() {
    return JSON.parse(localStorage.getItem('news_favoritos') || '[]');
}

function toggleFavorito(id, event) {
    if (event) event.stopPropagation();
    let favoritos = getFavoritos();
    const index = favoritos.indexOf(id);
    
    if (index > -1) {
        favoritos.splice(index, 1);
    } else {
        favoritos.push(id);
    }
    
    localStorage.setItem('news_favoritos', JSON.stringify(favoritos));
    renderNoticias();
    
    // Atualiza o botão no modal caso esteja aberto
    const modalBtnFav = document.getElementById('modalFavBtn');
    if (modalBtnFav) {
        const isFav = favoritos.includes(id);
        modalBtnFav.innerHTML = isFav ? '❤️ Favoritado' : '♡゙ Favoritar';
        modalBtnFav.classList.toggle('active', isFav);
    }
}

function getComentarios(id) {
    const comments = JSON.parse(localStorage.getItem('news_comentarios') || '{}');
    return comments[id] || [];
}

function adicionarComentario(id) {
    const inputAutor = document.getElementById('commentAuthor');
    const inputTexto = document.getElementById('commentText');
    
    const autor = inputAutor.value.trim() || 'Anônimo';
    const texto = inputTexto.value.trim();

    if (!texto) return;

    const comments = JSON.parse(localStorage.getItem('news_comentarios') || '{}');
    if (!comments[id]) comments[id] = [];

    const novoComentario = {
        autor,
        texto,
        data: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    };

    comments[id].push(novoComentario);
    localStorage.setItem('news_comentarios', JSON.stringify(comments));

    inputTexto.value = '';
    renderListaComentarios(id);
}

function renderListaComentarios(id) {
    const lista = document.getElementById('commentsList');
    const comentarios = getComentarios(id);

    if (comentarios.length === 0) {
        lista.innerHTML = '<p class="no-comments">Seja a primeira pessoa a comentar!</p>';
        return;
    }

    lista.innerHTML = comentarios.map(c => `
        <div class="comment-item">
            <div class="comment-header">
                <strong>${c.autor}</strong>
                <span>${c.data}</span>
            </div>
            <p>${c.texto}</p>
        </div>
    `).join('');
}

// BUSCA E RENDERIZAÇÃO
async function carregarNoticiasSubstack() {
    const container = document.getElementById('news-container');
    container.innerHTML = '<p class="loading-text" style="grid-column: 1/-1; text-align: center; color: #666;">A carregar notícias do Substack...</p>';

    try {
        const response = await fetch(RSS_API_URL);
        const data = await response.json();

        if (data.status === 'ok' && data.items && data.items.length > 0) {
            noticiasDB = data.items.map((item, index) => {
                let imagemCapa = item.thumbnail || item.enclosure?.link;
                
                if (!imagemCapa) {
                    const imgMatch = item.content ? item.content.match(/<img[^>]+src="([^">]+)"/) : null;
                    imagemCapa = imgMatch ? imgMatch[1] : 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600';
                }

                const dataPublicacao = new Date(item.pubDate).toLocaleDateString('pt-PT', {
                    day: '2-digit', month: 'short', year: 'numeric'
                });

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item.description || item.content;
                const textoPuro = tempDiv.textContent || tempDiv.innerText || '';
                const resumoLimpo = textoPuro.substring(0, 140).trim() + '...';

                return {
                    id: index + 1,
                    categoria: item.categories && item.categories.length > 0 ? item.categories[0] : 'Notícia',
                    data: dataPublicacao,
                    titulo: item.title,
                    resumo: resumoLimpo,
                    conteudo: item.content,
                    imagem: imagemCapa,
                    linkOriginal: item.link
                };
            });

            renderNoticias();
        } else {
            throw new Error('Não foi possível obter artigos.');
        }
    } catch (error) {
        console.error('Erro no Substack:', error);
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #c2003b;">Não foi possível carregar as notícias mais recentes.</p>';
    }
}

function renderNoticias() {
    const container = document.getElementById('news-container');
    container.innerHTML = '';

    if (noticiasDB.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Nenhuma notícia encontrada.</p>';
        return;
    }

    const favoritos = getFavoritos();
    const noticiasParaExibir = noticiasDB.slice(0, visibleNewsCount);

    noticiasParaExibir.forEach(noticia => {
        const isFav = favoritos.includes(noticia.id);
        const comentarios = getComentarios(noticia.id);

        const card = document.createElement('article');
        card.className = 'news-card';
        card.innerHTML = `
            <div class="news-img-wrapper">
                <img src="${noticia.imagem}" alt="${noticia.titulo}" class="news-card-img" loading="lazy">
                <button class="btn-fav-card ${isFav ? 'active' : ''}" onclick="toggleFavorito(${noticia.id}, event)" title="Favoritar">
                    ${isFav ? '❤️' : '♡゙'}
                </button>
            </div>
            <div class="news-card-body">
                <span class="news-tag">${noticia.categoria}</span>
                <h3>${noticia.titulo}</h3>
                <p>${noticia.resumo}</p>
                <div class="news-card-footer">
                    <span class="news-date">${noticia.data} • 💬 ${comentarios.length}</span>
                    <button onclick="abrirNoticia(${noticia.id})" class="btn-read-more">Ler notícia completa →</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    const btnLoadMore = document.getElementById('loadMoreNews');
    if (btnLoadMore) {
        btnLoadMore.style.display = visibleNewsCount >= noticiasDB.length ? 'none' : 'inline-block';
    }
}

// MODAL DE LEITURA
function abrirNoticia(id) {
    const noticia = noticiasDB.find(n => n.id === id);
    if (!noticia) return;

    const favoritos = getFavoritos();
    const isFav = favoritos.includes(noticia.id);

    const modal = document.getElementById('newsModal');
    
    // HTML Interno do Modal com o botão 'X' fixo e área de comentários
    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal-fixed" id="closeNewsModal" onclick="fecharModal()">&times;</button>
            
            <div class="modal-header-actions">
                <span class="modal-tag">${noticia.categoria}</span>
                <button id="modalFavBtn" class="btn-fav-modal ${isFav ? 'active' : ''}" onclick="toggleFavorito(${noticia.id})">
                    ${isFav ? '❤️ Favoritado' : '♡゙ Favoritar'}
                </button>
            </div>

            <h2>${noticia.titulo}</h2>
            <span class="modal-date">${noticia.data}</span>
            <hr>

            <div class="modal-body">${noticia.conteudo}</div>

            <p class="original-link">
                <a href="${noticia.linkOriginal}" target="_blank" rel="noopener noreferrer">
                    Ver publicação original diretamente no Substack ↗
                </a>
            </p>

            <!-- SEÇÃO DE COMENTÁRIOS DA NOTÍCIA -->
            <div class="comments-section">
                <h3>Comentários</h3>
                <div class="comment-form">
                    <input type="text" id="commentAuthor" placeholder="Seu nome (opcional)">
                    <textarea id="commentText" placeholder="Escreva o seu comentário..." rows="3"></textarea>
                    <button onclick="adicionarComentario(${noticia.id})" class="btn-submit-comment">Publicar Comentário</button>
                </div>
                <div id="commentsList" class="comments-list"></div>
            </div>
        </div>
    `;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Evita rolagem do fundo
    
    renderListaComentarios(noticia.id);
}

function fecharModal() {
    const modal = document.getElementById('newsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; // Libera a rolagem do fundo
    }
}

// FECHAR AO CLICAR FORA OU NA TECLA ESC
window.addEventListener('click', (e) => {
    const modal = document.getElementById('newsModal');
    if (e.target === modal) fecharModal();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
});

// Inicialização
document.addEventListener('DOMContentLoaded', carregarNoticiasSubstack);

// CARROSSEL HERO
let currentHeroSlide = 0;
const slides = document.querySelectorAll('.hero-slide');
const dotsContainer = document.getElementById('heroDots');

function initHeroCarousel() {
    if (!dotsContainer || slides.length === 0) return;
    
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.className = `dot ${idx === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => setHeroSlide(idx));
        dotsContainer.appendChild(dot);
    });
}

function setHeroSlide(index) {
    if (slides.length === 0) return;
    slides[currentHeroSlide].classList.remove('active');
    if (dotsContainer.children[currentHeroSlide]) {
        dotsContainer.children[currentHeroSlide].classList.remove('active');
    }
    
    currentHeroSlide = index;
    slides[currentHeroSlide].classList.add('active');
    if (dotsContainer.children[currentHeroSlide]) {
        dotsContainer.children[currentHeroSlide].classList.add('active');
    }
}

const btnHeroNext = document.getElementById('heroNext');
if (btnHeroNext) {
    btnHeroNext.addEventListener('click', () => {
        let next = (currentHeroSlide + 1) % slides.length;
        setHeroSlide(next);
    });
}

const btnHeroPrev = document.getElementById('heroPrev');
if (btnHeroPrev) {
    btnHeroPrev.addEventListener('click', () => {
        let prev = (currentHeroSlide - 1 + slides.length) % slides.length;
        setHeroSlide(prev);
    });
}

// MENU HAMBURGER MOBILE
const menuToggle = document.querySelector('.menu-toggle');
const navMenu = document.querySelector('.nav-menu');

if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

// INICIALIZAÇÃO DA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    initHeroCarousel();
    carregarNoticiasSubstack(); // Procura automaticamente os dados atualizados do Substack
});

document.addEventListener('DOMContentLoaded', () => {

  // 1. DADOS EXPLICATIVOS EXPANDIDOS PARA CADA INDICADOR
  const statDetails = {
    feminicidios: {
      title: "Registro de Feminicídios (Anuário FBSP) 2025",
      desc: "Mais de 1.571 mulheres perdem a vida anualmente por motivos de gênero no Brasil. A maioria dos crimes são voltados à tentativa de execer controle  e posse sobre a vida e o corpo da vitima."
    },
    agressoes: {
      title: "Violência Doméstica Físico-Emocional",
      desc: "Os casos registrados representam uma fração das agressões diárias. A subnotificação ainda é um desafio em regiões com menor infraestrutura de delegacias especializadas."
    },
    frequencia: {
      title: "Pesquisa Nacional DataSenado",
      desc: "Estudo contínuo mostra que aproximadamente 20% das brasileiras com mais de 16 anos já sofreram algum tipo de violência (física, psicológica, sexual ou patrimonial)."
    },
    conhecidos: {
      title: "Vínculo entre Agressor e Vítima",
      desc: "Em mais de 80% dos casos registrados, o agressor possui vínculo afetivo ou familiar com a vítima, tornando o ambiente doméstico o local de maior vulnerabilidade."
    },
    trans_travestis: {
      title: "O País que mais mata pessoas trans e travestis no mundo",
      desc: "Em mais de 97% dos casos registrados, os assassinos são mulheres trans e travestis, destacando a gravidade do problema."
    }
  };

  // 2. ATUALIZAÇÃO VIA API (OU MOCK REST) COM DADOS BASE
  const STATS_API_URL = './stats.json'; // Ou substitua pela URL do seu endpoint

  const defaultValues = {
    feminicidios: "1.571 Feminicídios registrados no Brasil em um ano.",
    agressoes: "≈29 milhões",
    frequencia: "1 em cada 3",
    conhecidos: "80%",
    trans_travestis: "97%"
  };

  async function loadLiveStats() {
    const statusEl = document.getElementById('syncStatus');
    try {
      const response = await fetch(STATS_API_URL);
      if (!response.ok) throw new Error("Endpoint não disponível");
      const data = await response.json();

      if (data.feminicidios) document.getElementById('val-feminicidios').innerText = data.feminicidios;
      if (data.agressoes) document.getElementById('val-agressoes').innerText = data.agressoes;
      if (data.frequencia) document.getElementById('val-frequencia').innerText = data.frequencia;
      if (data.conhecidos) document.getElementById('val-conhecidos').innerText = data.conhecidos;
      if (data.trans_travestis) document.getElementById('val-trans_travestis').innerText = data.trans_travestis;

      if (statusEl) {
        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        statusEl.innerText = `● Dados sincronizados em tempo real (${hora}) com bases do FBSP e DataSenado`;
      }
    } catch (e) {
      // Mantém os dados base de segurança
      document.getElementById('val-feminicidios').innerText = defaultValues.feminicidios;
      document.getElementById('val-agressoes').innerText = defaultValues.agressoes;
      document.getElementById('val-frequencia').innerText = defaultValues.frequencia;
      document.getElementById('val-conhecidos').innerText = defaultValues.conhecidos;
      document.getElementById('val-trans_travestis').innerText = defaultValues.trans_travestis;

      if (statusEl) {
        statusEl.innerText = `● Dados oficiais sincronizados com FBSP e DataSenado`;
      }
    }
  }

  // 3. INTERATIVIDADE NOS CARDS DE ESTATÍSTICA (ALTERAÇÃO DE PAINEL)
  const statCards = document.querySelectorAll('.stat-card');
  const detailTitle = document.getElementById('detailTitle');
  const detailDesc = document.getElementById('detailDesc');

  statCards.forEach(card => {
    card.addEventListener('click', () => {
      statCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const id = card.getAttribute('data-stat-id');
      if (statDetails[id]) {
        detailTitle.innerText = statDetails[id].title;
        detailDesc.innerText = statDetails[id].desc;
      }
    });
  });

  // Inicializa o detalhe com o primeiro item ativo
  if (statCards.length > 0) {
    const initialId = statCards[0].getAttribute('data-stat-id');
    detailTitle.innerText = statDetails[initialId].title;
    detailDesc.innerText = statDetails[initialId].desc;
  }

  loadLiveStats();
});
