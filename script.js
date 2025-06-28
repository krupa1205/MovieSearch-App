// OMDB API Configuration
const OMDB_API_KEY = 'caf11323';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';

// State Management
let currentMovies = [];
let watchlist = JSON.parse(localStorage.getItem('movieWatchlist')) || [];
let searchTimeout = null;
let isLoading = false;

// DOM Elements
const elements = {
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    yearFilter: document.getElementById('yearFilter'),
    typeFilter: document.getElementById('typeFilter'),
    moviesGrid: document.getElementById('moviesGrid'),
    watchlistGrid: document.getElementById('watchlistGrid'),
    loadingContainer: document.getElementById('loadingContainer'),
    noResults: document.getElementById('noResults'),
    resultsHeader: document.getElementById('resultsHeader'),
    resultsTitle: document.getElementById('resultsTitle'),
    resultsCount: document.getElementById('resultsCount'),
    watchlistCount: document.getElementById('watchlistCount'),
    watchlistSubtitle: document.getElementById('watchlistSubtitle'),
    emptyWatchlist: document.getElementById('emptyWatchlist'),
    modal: document.getElementById('movieModal'),
    modalBody: document.getElementById('modalBody'),
    toastContainer: document.getElementById('toastContainer')
};

// Utility Functions
function getPlaceholderImage() {
    return 'https://images.pexels.com/photos/1040160/pexels-photo-1040160.jpeg?auto=compress&cs=tinysrgb&w=400&h=600&dpr=1';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function updateWatchlistCount() {
    elements.watchlistCount.textContent = watchlist.length;
    elements.watchlistCount.style.display = watchlist.length > 0 ? 'block' : 'none';
    
    const count = watchlist.length;
    elements.watchlistSubtitle.textContent = count === 0 
        ? 'Your personal collection of movies to watch'
        : `${count} ${count === 1 ? 'movie' : 'movies'} in your watchlist`;
}

// API Functions
async function searchMovies(query, year = '', type = '') {
    let url = `${OMDB_BASE_URL}?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}`;
    
    if (year) url += `&y=${year}`;
    if (type) url += `&type=${type}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.Response === 'True' && data.Search) {
            // Get detailed info for movies
            const moviePromises = data.Search.slice(0, 20).map(async (movie) => {
                return await getMovieDetails(movie.imdbID);
            });
            
            const detailedMovies = await Promise.all(moviePromises);
            return detailedMovies.filter(movie => movie !== null);
        }
        return [];
    } catch (error) {
        console.error('Error searching movies:', error);
        return [];
    }
}

async function getMovieDetails(imdbID) {
    const url = `${OMDB_BASE_URL}?apikey=${OMDB_API_KEY}&i=${imdbID}&plot=full`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.Response === 'True') {
            return normalizeMovie(data);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching movie ${imdbID}:`, error);
        return null;
    }
}

function normalizeMovie(omdbMovie) {
    return {
        id: omdbMovie.imdbID,
        title: omdbMovie.Title,
        overview: omdbMovie.Plot !== 'N/A' ? omdbMovie.Plot : 'No description available.',
        poster: omdbMovie.Poster !== 'N/A' ? omdbMovie.Poster : null,
        year: omdbMovie.Year !== 'N/A' ? omdbMovie.Year : 'N/A',
        rating: omdbMovie.imdbRating !== 'N/A' ? parseFloat(omdbMovie.imdbRating) : 0,
        votes: omdbMovie.imdbVotes !== 'N/A' ? omdbMovie.imdbVotes : '0',
        runtime: omdbMovie.Runtime !== 'N/A' ? omdbMovie.Runtime : 'N/A',
        genre: omdbMovie.Genre !== 'N/A' ? omdbMovie.Genre : 'N/A',
        director: omdbMovie.Director !== 'N/A' ? omdbMovie.Director : 'N/A',
        actors: omdbMovie.Actors !== 'N/A' ? omdbMovie.Actors : 'N/A',
        rated: omdbMovie.Rated !== 'N/A' ? omdbMovie.Rated : 'N/A',
        awards: omdbMovie.Awards !== 'N/A' ? omdbMovie.Awards : 'N/A',
        boxOffice: omdbMovie.BoxOffice !== 'N/A' ? omdbMovie.BoxOffice : 'N/A',
        type: omdbMovie.Type || 'movie'
    };
}

// Watchlist Functions
function addToWatchlist(movie) {
    if (!isInWatchlist(movie.id)) {
        watchlist.push(movie);
        localStorage.setItem('movieWatchlist', JSON.stringify(watchlist));
        updateWatchlistCount();
        showToast('Added to watchlist!', 'success');
        updateWatchlistDisplay();
        updateActionButtons();
        return true;
    }
    return false;
}

function removeFromWatchlist(movieId) {
    watchlist = watchlist.filter(movie => movie.id !== movieId);
    localStorage.setItem('movieWatchlist', JSON.stringify(watchlist));
    updateWatchlistCount();
    showToast('Removed from watchlist', 'success');
    updateWatchlistDisplay();
    updateActionButtons();
}

function isInWatchlist(movieId) {
    return watchlist.some(movie => movie.id === movieId);
}

function toggleWatchlist(movieId) {
    const movie = currentMovies.find(m => m.id === movieId) || 
                  watchlist.find(m => m.id === movieId);
    
    if (!movie) return;
    
    if (isInWatchlist(movieId)) {
        removeFromWatchlist(movieId);
    } else {
        addToWatchlist(movie);
    }
}

// UI Functions
function showLoading() {
    elements.loadingContainer.style.display = 'flex';
    elements.noResults.style.display = 'none';
    elements.resultsHeader.style.display = 'none';
}

function hideLoading() {
    elements.loadingContainer.style.display = 'none';
}

function showNoResults() {
    elements.noResults.style.display = 'block';
    elements.loadingContainer.style.display = 'none';
    elements.resultsHeader.style.display = 'none';
}

function showResults(query, count) {
    elements.resultsHeader.style.display = 'flex';
    elements.resultsTitle.textContent = `Search Results for "${query}"`;
    elements.resultsCount.textContent = `${count} ${count === 1 ? 'result' : 'results'}`;
    elements.loadingContainer.style.display = 'none';
    elements.noResults.style.display = 'none';
}

function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    
    const posterUrl = movie.poster || getPlaceholderImage();
    const rating = movie.rating > 0 ? movie.rating.toFixed(1) : 'N/A';
    const isWatchlisted = isInWatchlist(movie.id);
    
    card.innerHTML = `
        <div class="movie-poster">
            <img src="${posterUrl}" alt="${movie.title}" onerror="this.src='${getPlaceholderImage()}'">
            <div class="movie-overlay">
                <button class="play-btn" onclick="openMovieModal('${movie.id}')">
                    <i class="fas fa-play"></i>
                </button>
            </div>
            <div class="movie-actions">
                <button class="action-btn ${isWatchlisted ? 'active' : ''}" 
                        onclick="toggleWatchlist('${movie.id}')" 
                        title="${isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                    <i class="fas fa-bookmark"></i>
                </button>
            </div>
            ${movie.rating > 0 ? `
                <div class="movie-rating">
                    <i class="fas fa-star"></i>
                    <span>${rating}</span>
                </div>
            ` : ''}
        </div>
        <div class="movie-info">
            <h3 class="movie-title">${movie.title}</h3>
            <div class="movie-meta">
                <span>${movie.year}</span>
                <span>•</span>
                <span>${movie.type.charAt(0).toUpperCase() + movie.type.slice(1)}</span>
                ${movie.runtime !== 'N/A' ? `<span>•</span><span>${movie.runtime}</span>` : ''}
            </div>
            <p class="movie-description">${movie.overview}</p>
        </div>
    `;
    
    // Add click event for the card (excluding action buttons)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.movie-actions') && !e.target.closest('.play-btn')) {
            openMovieModal(movie.id);
        }
    });
    
    return card;
}

function populateMovieGrid(container, movies) {
    container.innerHTML = '';
    
    if (movies.length === 0) {
        return;
    }
    
    movies.forEach(movie => {
        if (movie) {
            container.appendChild(createMovieCard(movie));
        }
    });
}

function updateActionButtons() {
    // Update all watchlist buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        const movieId = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (movieId && btn.getAttribute('onclick').includes('toggleWatchlist')) {
            const isWatchlisted = isInWatchlist(movieId);
            btn.classList.toggle('active', isWatchlisted);
            btn.title = isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist';
        }
    });
}

function updateWatchlistDisplay() {
    if (watchlist.length === 0) {
        elements.emptyWatchlist.style.display = 'block';
        elements.watchlistGrid.style.display = 'none';
    } else {
        elements.emptyWatchlist.style.display = 'none';
        elements.watchlistGrid.style.display = 'grid';
        populateMovieGrid(elements.watchlistGrid, watchlist);
    }
}

// Modal Functions
async function openMovieModal(movieId) {
    const movie = currentMovies.find(m => m.id === movieId) || 
                  watchlist.find(m => m.id === movieId);
    
    if (!movie) {
        const fetchedMovie = await getMovieDetails(movieId);
        if (!fetchedMovie) {
            showToast('Movie details not found', 'error');
            return;
        }
        openMovieModalWithData(fetchedMovie);
        return;
    }
    
    openMovieModalWithData(movie);
}

function openMovieModalWithData(movie) {
    elements.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const posterUrl = movie.poster || getPlaceholderImage();
    const rating = movie.rating > 0 ? movie.rating.toFixed(1) : 'N/A';
    const isWatchlisted = isInWatchlist(movie.id);
    
    elements.modalBody.innerHTML = `
        <div style="position: relative; height: 400px; overflow: hidden;">
            <img src="${posterUrl}" 
                 alt="${movie.title}"
                 style="width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.src='${getPlaceholderImage()}'">
            <div style="position: absolute; inset: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9));">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px;">
                    <div style="display: flex; gap: 24px; align-items: flex-end;">
                        <img src="${posterUrl}" 
                             alt="${movie.title}"
                             style="width: 120px; height: 180px; object-fit: cover; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);"
                             onerror="this.src='${getPlaceholderImage()}'">
                        <div style="flex: 1;">
                            <h1 style="font-size: 36px; font-weight: 800; margin-bottom: 8px; color: white;">${movie.title}</h1>
                            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px; color: rgba(255,255,255,0.8);">
                                <span>${movie.year}</span>
                                <span>•</span>
                                <span>${movie.rated}</span>
                                <span>•</span>
                                <span>${movie.runtime}</span>
                                ${movie.rating > 0 ? `
                                    <span>•</span>
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <i class="fas fa-star" style="color: #ffd700;"></i>
                                        <span>${rating}/10</span>
                                    </div>
                                ` : ''}
                            </div>
                            <div style="display: flex; gap: 12px;">
                                <button onclick="toggleWatchlist('${movie.id}')" 
                                        style="display: flex; align-items: center; gap: 8px; padding: 12px 24px; background: ${isWatchlisted ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #ff6b35, #ffd700)'}; border: none; border-radius: 12px; color: white; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                                    <i class="fas fa-bookmark"></i>
                                    <span>${isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="padding: 40px;">
            ${movie.genre !== 'N/A' ? `
                <div style="margin-bottom: 32px;">
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: white;">Genres</h3>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${movie.genre.split(', ').map(genre => `
                            <span style="padding: 6px 16px; background: linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,215,0,0.2)); border: 1px solid rgba(255,107,53,0.3); color: #ff6b35; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                ${genre}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div style="margin-bottom: 32px;">
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: white;">Overview</h3>
                <p style="color: rgba(255,255,255,0.8); line-height: 1.6; font-size: 16px;">${movie.overview}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 32px;">
                <div>
                    <h4 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; color: white;">Cast & Crew</h4>
                    <div style="space-y: 12px;">
                        <div style="margin-bottom: 12px;">
                            <span style="color: rgba(255,255,255,0.6); font-weight: 600;">Director:</span>
                            <span style="color: white; margin-left: 8px;">${movie.director}</span>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <span style="color: rgba(255,255,255,0.6); font-weight: 600;">Actors:</span>
                            <span style="color: white; margin-left: 8px;">${movie.actors}</span>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h4 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; color: white;">Details</h4>
                    <div style="space-y: 12px;">
                        <div style="margin-bottom: 12px;">
                            <span style="color: rgba(255,255,255,0.6); font-weight: 600;">Box Office:</span>
                            <span style="color: white; margin-left: 8px;">${movie.boxOffice}</span>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <span style="color: rgba(255,255,255,0.6); font-weight: 600;">Awards:</span>
                            <span style="color: white; margin-left: 8px;">${movie.awards}</span>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <span style="color: rgba(255,255,255,0.6); font-weight: 600;">Votes:</span>
                            <span style="color: white; margin-left: 8px;">${movie.votes}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function closeModal() {
    elements.modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Search Functions
async function performSearch(query, year = '', type = '') {
    if (!query.trim()) return;
    
    showLoading();
    
    try {
        const results = await searchMovies(query, year, type);
        
        if (results.length > 0) {
            currentMovies = results;
            populateMovieGrid(elements.moviesGrid, results);
            showResults(query, results.length);
        } else {
            showNoResults();
        }
        
    } catch (error) {
        console.error('Error searching movies:', error);
        showToast('Search failed', 'error');
        showNoResults();
    } finally {
        hideLoading();
    }
}

// Navigation Functions
function showSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Update sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    if (sectionName === 'search') {
        document.getElementById('searchSection').classList.add('active');
    } else if (sectionName === 'watchlist') {
        document.getElementById('watchlistSection').classList.add('active');
        updateWatchlistDisplay();
    }
}

// Event Listeners
function setupEventListeners() {
    // Search functionality
    elements.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        elements.searchClear.style.display = query ? 'block' : 'none';
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query.length >= 3) {
                const year = elements.yearFilter.value;
                const type = elements.typeFilter.value;
                performSearch(query, year, type);
            } else if (query.length === 0) {
                elements.moviesGrid.innerHTML = '';
                elements.resultsHeader.style.display = 'none';
                elements.noResults.style.display = 'none';
                hideLoading();
            }
        }, 500);
    });
    
    // Clear search
    elements.searchClear.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.searchClear.style.display = 'none';
        elements.moviesGrid.innerHTML = '';
        elements.resultsHeader.style.display = 'none';
        elements.noResults.style.display = 'none';
        hideLoading();
    });
    
    // Filter changes
    elements.yearFilter.addEventListener('change', () => {
        const query = elements.searchInput.value.trim();
        if (query.length >= 3) {
            const year = elements.yearFilter.value;
            const type = elements.typeFilter.value;
            performSearch(query, year, type);
        }
    });
    
    elements.typeFilter.addEventListener('change', () => {
        const query = elements.searchInput.value.trim();
        if (query.length >= 3) {
            const year = elements.yearFilter.value;
            const type = elements.typeFilter.value;
            performSearch(query, year, type);
        }
    });
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            showSection(section);
        });
    });
    
    // Modal events
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal || e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal.classList.contains('active')) {
            closeModal();
        }
    });
}

// Make functions globally available
window.toggleWatchlist = toggleWatchlist;
window.openMovieModal = openMovieModal;
window.closeModal = closeModal;
window.showSection = showSection;

// Initialize app
function initializeApp() {
    console.log('Initializing CineStream app...');
    
    // Update watchlist count
    updateWatchlistCount();
    
    // Setup event listeners
    setupEventListeners();
    
    // Show search section by default
    showSection('search');
    
    console.log('CineStream app initialized successfully');
}

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}