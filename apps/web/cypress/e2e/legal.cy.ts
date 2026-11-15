describe('Legal pages', () => {
  beforeEach(() => cy.fakeYouTube());

  it('are public and linked from the sign-in page', () => {
    cy.visit('/login');
    cy.contains('a', 'Confidentialité').click();
    cy.location('pathname').should('eq', '/privacy');
    cy.contains('h1', 'Politique de confidentialité');
    cy.contains('a', 'nyfatratrar@gmail.com').should('have.attr', 'href', 'mailto:nyfatratrar@gmail.com');

    cy.contains('footer a', "Conditions d'utilisation").click();
    cy.location('pathname').should('eq', '/terms');
    cy.contains('h1', "Conditions d'utilisation");
    cy.title().should('eq', "Conditions d'utilisation — FEO");
  });

  it('stay reachable when signed in', () => {
    cy.visitSignedIn('/privacy');
    cy.contains('h1', 'Politique de confidentialité');
  });
});



describe('Landing and install pages', () => {
  it('welcomes anonymous visitors with the landing page and its install QR code', () => {
    cy.visit('/');
    cy.contains('h1', 'Henoy ara');
    cy.get('#installer svg[role="img"]').should('have.attr', 'aria-label').and('contain', '/install');
    cy.contains('a', 'Commencer gratuitement').should('have.attr', 'href', '/register');
  });

  it('explains how to install on Android and iPhone', () => {
    cy.visit('/install');
    cy.contains('h1', 'Installer FEO');
    cy.contains('a', 'Télécharger pour Android').should('have.attr', 'href').and('match', /feo\.apk$/);
    cy.contains("Sur l'écran d'accueil");
  });
});
export {};
