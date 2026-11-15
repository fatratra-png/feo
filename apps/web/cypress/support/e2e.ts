/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Creates a fresh account through the API and returns its credentials. */
      signUp(name?: string): Chainable<{ email: string; password: string; accessToken: string; refreshToken: string }>;
      /** Visits a page already signed in as a fresh account. */
      visitSignedIn(path?: string, opts?: { embed?: boolean }): Chainable<{ email: string; password: string }>;
      /** Fakes everything that would hit YouTube. `blocked` simulates the API's IP being bot-checked. */
      fakeYouTube(opts?: { stream?: 'ok' | 'blocked' }): Chainable<void>;
    }
  }
}

/** Same port as the `e2e:api` script. */
const api = () => 'http://localhost:3101/api';
let counter = 0;

Cypress.Commands.add('signUp', (name = 'Rakoto') => {
  const email = `e2e-${Date.now()}-${++counter}@example.com`;
  const password = 'correct-horse-battery';
  return cy
    .request('POST', `${api()}/auth/register`, { email, password, displayName: name })
    .then(({ body }) => ({ email, password, accessToken: body.accessToken, refreshToken: body.refreshToken }));
});

Cypress.Commands.add('visitSignedIn', (path = '/', opts = {}) => {
  return cy.signUp().then((account) => {
    cy.visit(path, {
      onBeforeLoad(win) {
        win.localStorage.setItem('feo_access_token', account.accessToken);
        win.localStorage.setItem('feo_refresh_token', account.refreshToken);
        if (opts.embed) win.localStorage.setItem('feo_embed_until', String(Date.now() + 3_600_000));
      },
    });
    return cy.wrap({ email: account.email, password: account.password });
  });
});

Cypress.Commands.add('fakeYouTube', ({ stream = 'ok' } = {}) => {
  cy.intercept('GET', '**/api/search?q=*', { fixture: 'search-mahaleo.json' }).as('search');
  cy.intercept('GET', '**/api/thumb/*', { fixture: 'cover.png,null', headers: { 'Content-Type': 'image/png' } });
  cy.intercept('GET', '**/api/health', { body: { status: 'ok', ai: false, aiPausedUntil: null, youtubeBlockedUntil: null } });
  cy.intercept('GET', 'https://www.youtube.com/iframe_api', { fixture: 'fake-youtube-iframe-api.txt', headers: { 'Content-Type': 'text/javascript' } }).as('iframeApi');
  if (stream === 'blocked') {
    cy.intercept('GET', '**/api/stream/*', { statusCode: 503, body: { message: 'YouTube limite temporairement les requêtes', code: 'YOUTUBE_BLOCKED' } }).as('stream');
  } else {
    cy.intercept('GET', '**/api/stream/*', { fixture: 'silence.wav,null', headers: { 'Content-Type': 'audio/wav' } }).as('stream');
  }
  // The radio would ask YouTube for more songs when the queue runs low.
  cy.intercept('POST', '**/api/radio', { body: { songs: [], source: 'mix' } });
});

export {};
