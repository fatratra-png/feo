describe('Library', () => {
  beforeEach(() => {
    cy.fakeYouTube();
    cy.visitSignedIn('/search?q=mahaleo');
    cy.wait('@search');
  });

  it('likes a song and finds it in "Titres likés"', () => {
    cy.contains('li', 'Madirovo').first().within(() => {
      cy.get('[aria-label="Ajouter aux titres likés"]').click({ force: true });
      cy.get('[aria-label="Retirer des titres likés"]').should('have.attr', 'aria-pressed', 'true');
    });
    cy.visit('/liked');
    cy.contains('Madirovo');
    cy.contains('Bagdad').should('not.exist');

    // Persisted server-side.
    cy.reload();
    cy.contains('Madirovo');
  });

  it('creates a playlist from a song, then renames and deletes it', () => {
    cy.get('[aria-label="Plus d\'options pour Bagdad"]').first().click({ force: true });
    cy.contains('[role="menuitem"]', 'Ajouter à une playlist').click();
    cy.get('[role="dialog"]').within(() => {
      cy.contains('Nouvelle playlist').click();
      // The name is pre-filled with the song title.
      cy.get('input').first().should('have.value', 'Bagdad').clear().type('Soirée e2e');
      cy.contains('button', 'Créer').click();
    });

    // The new playlist opens, with the song in it, and shows up in the sidebar.
    cy.location('pathname').should('match', /^\/playlist\//);
    cy.contains('h1', 'Soirée e2e');
    cy.contains('li', 'Bagdad');
    cy.contains('[aria-label="Tes playlists"]', 'Soirée e2e');

    cy.get('[aria-label="Modifier les détails"]').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('input').first().clear().type('Matin calme');
      cy.contains('button', 'Enregistrer').click();
    });
    cy.contains('h1', 'Matin calme');

    cy.get('[aria-label="Supprimer la playlist"]').click();
    cy.get('[role="dialog"]').contains('button', 'Supprimer').click();
    cy.location('pathname').should('eq', '/library');
    cy.location('pathname').should('not.match', /^\/playlist\//);
    cy.contains('[aria-label="Tes playlists"]', 'Matin calme').should('not.exist');
  });
});

export {};
