const audioEl = () => cy.get('audio');
const playerBar = () => cy.get('[role="region"][aria-label="Lecteur"]');

describe('Search and playback', () => {
  beforeEach(() => {
    cy.fakeYouTube();
    cy.visitSignedIn('/search?q=mahaleo');
    cy.wait('@search');
  });

  it('shows search results', () => {
    cy.contains('Vololona');
    cy.contains('Bagdad');
    cy.contains('Madirovo');
  });

  it('plays a song through the API audio proxy', () => {
    cy.get('[aria-label="Lire Bagdad de Mahaleo"]').first().click();
    cy.wait('@stream').its('request.url').should('match', /\/api\/stream\/e2eBagdad01$/);
    audioEl().should(($a) => {
      const a = $a[0] as HTMLAudioElement;
      expect(a.getAttribute('src')).to.match(/\/stream\/e2eBagdad01$/);
      expect(a.paused).to.eq(false);
      expect(a.currentTime).to.be.greaterThan(0.3);
    });
    playerBar().should('contain.text', 'Bagdad');
    cy.title().should('eq', 'Bagdad · Mahaleo — FEO');
  });

  it('pauses, resumes and skips with the keyboard', () => {
    cy.get('[aria-label="Lire Bagdad de Mahaleo"]').first().click();
    audioEl().should(($a) => expect(($a[0] as HTMLAudioElement).paused).to.eq(false));

    // Space on a focused button activates the button: shortcuts apply elsewhere.
    cy.focused().blur();
    cy.get('body').type(' ');
    audioEl().should(($a) => expect(($a[0] as HTMLAudioElement).paused).to.eq(true));
    cy.get('body').type(' ');
    audioEl().should(($a) => expect(($a[0] as HTMLAudioElement).paused).to.eq(false));

    cy.get('body').type('{shift}{rightArrow}');
    cy.title().should('eq', 'Madirovo · Mahaleo — FEO');
    audioEl().should('have.attr', 'src').and('match', /e2eMadirovo$/);
  });

  it('pauses from the player bar button', () => {
    cy.get('[aria-label="Lire Madirovo de Mahaleo"]').first().click();
    playerBar().find('button[aria-label="Pause"]').click();
    audioEl().should(($a) => expect(($a[0] as HTMLAudioElement).paused).to.eq(true));
    playerBar().find('button[aria-label="Lecture"]').should('exist');
  });
});

export {};
