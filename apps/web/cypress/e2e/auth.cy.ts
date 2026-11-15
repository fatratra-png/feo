describe('Authentication', () => {
  beforeEach(() => cy.fakeYouTube());

  it('sends anonymous visitors to the login page', () => {
    cy.visit('/library');
    cy.location('pathname').should('eq', '/login');
    cy.contains('h1', 'Content de te revoir');
  });

  it('validates the sign-up form before calling the API', () => {
    cy.visit('/register');
    cy.contains('button', 'Créer mon compte').click();
    cy.contains('Au moins 2 caractères');
    cy.contains('Email invalide');
    cy.contains('Au moins 8 caractères');
    cy.location('pathname').should('eq', '/register');
  });

  it('signs up, signs out and signs back in', () => {
    const email = `e2e-ui-${Date.now()}@example.com`;
    cy.visit('/register');
    cy.get('#name').type('Fara');
    cy.get('#email').type(email);
    cy.get('#password').type('correct-horse-battery');
    cy.contains('button', 'Créer mon compte').click();

    cy.location('pathname').should('eq', '/');
    cy.get('[aria-label="Menu du compte"]').should('contain.text', 'F').click();
    cy.contains('[role="menuitem"]', 'Se déconnecter').click();
    cy.location('pathname').should('eq', '/login');

    cy.get('#email').type(email);
    cy.get('#password').type('wrong-password');
    cy.contains('button', 'Se connecter').click();
    cy.get('[role="alert"]').should('contain.text', 'Email ou mot de passe incorrect');

    cy.get('#password').clear().type('correct-horse-battery');
    cy.contains('button', 'Se connecter').click();
    cy.location('pathname').should('eq', '/');
  });

  it('refuses an email that already has an account', () => {
    cy.signUp().then(({ email }) => {
      cy.visit('/register');
      cy.get('#name').type('Copie');
      cy.get('#email').type(email);
      cy.get('#password').type('correct-horse-battery');
      cy.contains('button', 'Créer mon compte').click();
      cy.get('[role="alert"]').should('contain.text', 'Cet email est déjà utilisé');
    });
  });

  it('keeps the session across reloads', () => {
    cy.visitSignedIn('/library');
    cy.contains('h1', 'Bibliothèque');
    cy.reload();
    cy.contains('h1', 'Bibliothèque');
  });
});

export {};
