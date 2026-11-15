/**
 * The API's host can get "confirm you're not a bot" from YouTube, which makes
 * /api/stream fail. The player must then switch to the YouTube embed on its own.
 */
const playerBar = () => cy.get('[role="region"][aria-label="Lecteur"]');
const fakeYT = () => cy.window().its('__fakeYT');

describe('Playback when YouTube blocks the API', () => {
  beforeEach(() => cy.fakeYouTube({ stream: 'blocked' }));

  it('falls back to the YouTube player without interrupting the listener', () => {
    cy.visitSignedIn('/search?q=mahaleo');
    cy.wait('@search');
    cy.get('[aria-label="Lire Bagdad de Mahaleo"]').first().click();

    cy.wait('@stream');
    cy.wait('@iframeApi');
    fakeYT().its('loaded').should('deep.equal', ['e2eBagdad01']);
    cy.get('audio').should('not.have.attr', 'src');
    // Progress keeps moving in the player bar.
    playerBar().contains(/0:0[1-9]/, { timeout: 6000 });
    cy.contains('est indisponible').should('not.exist');

    // Remembered: the next song goes straight to the embed, no new proxy attempt.
    cy.window().then((win) => expect(win.localStorage.getItem('feo_embed_until')).to.be.a('string'));
    cy.get('body').type('{shift}{rightArrow}');
    fakeYT().its('loaded').should('deep.equal', ['e2eBagdad01', 'e2eMadirovo']);
    cy.get('@stream.all').should('have.length', 1);
  });

  it('pauses and resumes the embed', () => {
    cy.visitSignedIn('/search?q=mahaleo', { embed: true });
    cy.wait('@search');
    cy.get('[aria-label="Lire Bagdad de Mahaleo"]').first().click();
    fakeYT().its('state').should('eq', 1);
    playerBar().find('button[aria-label="Pause"]').click();
    fakeYT().its('state').should('eq', 2);
    playerBar().find('button[aria-label="Lecture"]').click();
    fakeYT().its('state').should('eq', 1);
  });

  it('skips a song the embed refuses to play', () => {
    cy.visitSignedIn('/search?q=mahaleo', { embed: true });
    cy.wait('@search');
    cy.get('[aria-label="Lire Bagdad de Mahaleo"]').first().click();
    fakeYT().its('loaded').should('have.length', 1);
    fakeYT().then((yt: { fail: (code: number) => void }) => yt.fail(150));
    cy.contains('« Bagdad » est indisponible, titre suivant');
    fakeYT().its('loaded').should('deep.equal', ['e2eBagdad01', 'e2eMadirovo']);
  });
});

export {};
