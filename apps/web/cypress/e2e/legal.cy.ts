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

export {};
