const API = 'http://localhost:3101/api';

describe('Password management', () => {
  beforeEach(() => cy.fakeYouTube());

  it('changes the password from "Mon compte"', () => {
    cy.visitSignedIn('/').then(({ email, password }) => {
      cy.get('[aria-label="Menu du compte"]').click();
      cy.contains('[role="menuitem"]', 'Mon compte').click();
      cy.contains('h1', 'Mon compte');
      cy.contains(email);

      cy.get('#current-password').type('not-my-password');
      cy.get('#new-password').type('a-brand-new-one');
      cy.get('#confirm-password').type('a-brand-new-one');
      cy.contains('button', 'Changer le mot de passe').click();
      cy.get('#current-password-error').should('contain.text', 'Mot de passe actuel incorrect');

      cy.get('#current-password').clear().type(password);
      cy.contains('button', 'Changer le mot de passe').click();
      cy.contains('Mot de passe modifié');

      // Still signed in after a reload (fresh tokens were stored)…
      cy.reload();
      cy.contains('h1', 'Mon compte');
      // …and only the new password works.
      cy.request({ method: 'POST', url: `${API}/auth/login`, body: { email, password }, failOnStatusCode: false }).its('status').should('eq', 401);
      cy.request('POST', `${API}/auth/login`, { email, password: 'a-brand-new-one' }).its('status').should('eq', 200);
    });
  });

  it('checks that both new passwords match', () => {
    cy.visitSignedIn('/account');
    cy.get('#current-password').type('whatever-123');
    cy.get('#new-password').type('a-brand-new-one');
    cy.get('#confirm-password').type('something-else');
    cy.contains('button', 'Changer le mot de passe').click();
    cy.get('#confirm-password-error').should('contain.text', 'ne correspondent pas');
  });

  it('resets a forgotten password through the emailed link', () => {
    cy.signUp().then(({ email }) => {
      cy.visit('/login');
      cy.get('#email').type(email);
      cy.contains('a', 'Mot de passe oublié ?').click();
      cy.location('pathname').should('eq', '/forgot-password');
      cy.get('#email').should('have.value', email); // carried over from the login form
      cy.contains('button', 'Envoyer le lien').click();
      cy.contains('h1', 'Vérifie ta boîte mail');

      cy.request(`${API}/test/outbox?to=${encodeURIComponent(email)}`).then(({ body }) => {
        const link: string = body[body.length - 1].text.match(/https?:\/\/\S+/)[0];
        const url = new URL(link);
        cy.visit(url.pathname + url.search);
      });
      cy.contains('h1', 'Nouveau mot de passe');
      cy.get('#password').type('reset-password-1');
      cy.get('#confirm').type('reset-password-1');
      cy.contains('button', 'Enregistrer et me connecter').click();

      // Signed in straight away.
      cy.location('pathname').should('eq', '/');
      cy.get('[aria-label="Menu du compte"]').should('exist');
      cy.request('POST', `${API}/auth/login`, { email, password: 'reset-password-1' }).its('status').should('eq', 200);
    });
  });

  it('explains when a reset link has already been used', () => {
    cy.visit('/reset-password?token=this-token-does-not-exist-at-all');
    cy.get('#password').type('reset-password-1');
    cy.get('#confirm').type('reset-password-1');
    cy.contains('button', 'Enregistrer et me connecter').click();
    cy.get('[role="alert"]').should('contain.text', 'expiré ou a déjà servi');
  });
});

describe('Google / GitHub sign-in', () => {
  beforeEach(() => cy.fakeYouTube());

  it('shows the providers configured on the API', () => {
    cy.intercept('GET', '**/api/auth/providers', { body: { google: true, github: false, passwordResetEmail: true } });
    cy.visit('/login');
    cy.contains('a', 'Continuer avec Google').should('have.attr', 'href', `${API}/auth/oauth/google/start`);
    cy.contains('Continuer avec GitHub').should('not.exist');
  });

  it('hides the buttons when no provider is configured', () => {
    cy.intercept('GET', '**/api/auth/providers', { body: { google: false, github: false, passwordResetEmail: false } });
    cy.visit('/register');
    cy.contains('Continuer avec').should('not.exist');
  });

  it('finishes the login when the API sends the browser back with a code', () => {
    cy.signUp('Hery').then((account) => {
      cy.intercept('POST', '**/api/auth/oauth/exchange', (req) => {
        expect(req.body).to.deep.equal({ code: 'one-time-code-from-api' });
        req.reply({ user: { id: 'x', email: account.email, displayName: 'Hery', avatarUrl: null, createdAt: new Date().toISOString() }, accessToken: account.accessToken, refreshToken: account.refreshToken });
      });
      cy.visit('/auth/callback?code=one-time-code-from-api');
      cy.location('pathname').should('eq', '/');
      cy.get('[aria-label="Menu du compte"]').should('contain.text', 'H');
    });
  });

  it('brings the user back to the login page with the reason on failure', () => {
    cy.visit('/auth/callback?error=Connexion%20annul%C3%A9e.');
    cy.location('pathname').should('eq', '/login');
    cy.get('[role="alert"]').should('contain.text', 'Connexion annulée.');
  });
});

export {};
