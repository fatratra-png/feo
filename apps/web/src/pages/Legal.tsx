import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { Logo } from '../components/ui/Logo';

/*
 * No router or store imports here: these pages are also rendered to static
 * HTML at build time (see vite.config.ts), so crawlers such as Google's OAuth
 * review see the full text without running JavaScript. Hence plain <a> links.
 */

const CONTACT = 'nyfatratrar@gmail.com';
const UPDATED = '15 novembre 2026';

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => {
    document.title = `${title} — FEO`;
  }, [title]);

  return (
    <div className="min-h-dvh bg-bg px-5 py-10 sm:py-16">
      <article className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <a href="/" aria-label="FEO, accueil"><Logo className="text-3xl" /></a>
          <a href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-2 hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> Retour à FEO
          </a>
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-fg-3">Dernière mise à jour : {UPDATED}</p>
        <div className="mt-8 space-y-8 leading-relaxed text-fg-2 [&_a]:font-semibold [&_a]:text-accent-fg [&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_strong]:text-fg [&_ul]:mb-3 [&_ul]:space-y-1.5">
          {children}
        </div>
        <footer className="mt-12 border-t border-line-strong pt-6 text-sm text-fg-3">
          Une question ? <a href={`mailto:${CONTACT}`} className="font-semibold text-accent-fg underline">{CONTACT}</a>
          {' · '}<a href="/privacy" className="hover:text-fg">Confidentialité</a>
          {' · '}<a href="/terms" className="hover:text-fg">Conditions d'utilisation</a>
        </footer>
      </article>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Politique de confidentialité">
      <section>
        <p>
          FEO est un lecteur de musique qui s'appuie sur le catalogue YouTube et sur une IA pour composer des playlists et
          une radio. Cette page explique quelles données FEO collecte, pourquoi, avec qui elles sont partagées et comment
          les faire supprimer.
        </p>
      </section>

      <section>
        <h2>Ce que nous collectons</h2>
        <ul>
          <li><strong>Ton compte</strong> : email, prénom ou pseudo, et mot de passe stocké uniquement sous forme chiffrée (bcrypt). Nous ne pouvons pas le lire.</li>
          <li><strong>Connexion avec Google ou GitHub</strong> : l'identifiant du compte chez ce fournisseur, ton email vérifié, ton nom et ta photo de profil. Nous ne demandons aucun autre accès (ni contacts, ni dépôts, ni fichiers).</li>
          <li><strong>Ton utilisation de FEO</strong> : titres likés, playlists, historique d'écoute (titre écouté, durée d'écoute, titre passé ou écouté jusqu'au bout) et mix générés pour toi.</li>
          <li><strong>Données techniques</strong> : journaux du serveur (adresse IP, date, page demandée) conservés quelques jours pour la sécurité et le diagnostic.</li>
        </ul>
        <p>FEO n'utilise ni publicité, ni outil de mesure d'audience, ni cookie de suivi.</p>
      </section>

      <section>
        <h2>Pourquoi</h2>
        <ul>
          <li>Te connecter et garder ta bibliothèque d'un appareil à l'autre.</li>
          <li>Personnaliser la radio et les mix à partir de ce que tu écoutes, aimes ou passes.</li>
          <li>Envoyer les emails nécessaires au service, comme un lien de réinitialisation de mot de passe. Aucune newsletter.</li>
          <li>Protéger le service contre les abus (limitation des tentatives de connexion, par exemple).</li>
        </ul>
      </section>

      <section>
        <h2>Avec qui ces données sont partagées</h2>
        <p>Nous ne vendons aucune donnée. Elles transitent uniquement par les prestataires nécessaires au fonctionnement de FEO :</p>
        <ul>
          <li><strong>Vercel</strong> héberge le site, <strong>Render</strong> l'API et <strong>Neon</strong> la base de données.</li>
          <li><strong>OpenRouter</strong> et les modèles d'IA qu'il relaie reçoivent tes demandes (par exemple « une soirée salegy et afro ») et, pour personnaliser, les noms de tes artistes préférés. Ni ton email ni ton nom ne leur sont envoyés.</li>
          <li><strong>YouTube</strong> fournit la musique et les pochettes. Quand le lecteur YouTube intégré est utilisé, YouTube et Google peuvent déposer leurs propres cookies, selon les <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">règles de confidentialité de Google</a>.</li>
          <li><strong>Google</strong> et <strong>GitHub</strong>, seulement si tu choisis de te connecter avec eux.</li>
          <li><strong>Resend</strong> envoie les emails de réinitialisation de mot de passe.</li>
        </ul>
        <p>Ces prestataires peuvent traiter les données hors de Madagascar, notamment aux États-Unis.</p>
      </section>

      <section>
        <h2>Stockage dans ton navigateur</h2>
        <p>
          FEO enregistre dans ton navigateur ta session (jetons de connexion) et tes préférences (thème, volume, lecture
          aléatoire). Ces données restent sur ton appareil et disparaissent quand tu te déconnectes ou vides les données du site.
        </p>
      </section>

      <section>
        <h2>Durée de conservation</h2>
        <ul>
          <li>Ton compte et ta bibliothèque : tant que ton compte existe.</li>
          <li>Sessions : 30 jours sans activité au maximum.</li>
          <li>Liens de réinitialisation de mot de passe : 1 heure, à usage unique.</li>
          <li>Suggestions de l'IA mises en cache : quelques heures.</li>
        </ul>
      </section>

      <section>
        <h2>Tes droits</h2>
        <p>
          Tu peux demander à consulter, corriger, exporter ou supprimer tes données, ou supprimer ton compte, en écrivant
          à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Nous répondons sous 30 jours. Ces droits te sont garantis par la
          loi malgache n° 2014-038 sur la protection des données à caractère personnel et, si tu résides dans l'Union
          européenne, par le RGPD.
        </p>
        <p>Tu peux à tout moment changer ton mot de passe depuis « Mon compte », ou retirer l'accès de FEO dans les réglages de ton compte Google ou GitHub.</p>
      </section>

      <section>
        <h2>Sécurité</h2>
        <p>
          Les échanges sont chiffrés (HTTPS), les mots de passe et les liens de réinitialisation ne sont jamais stockés en
          clair, et un changement de mot de passe déconnecte tous tes autres appareils.
        </p>
      </section>

      <section>
        <h2>Âge minimum</h2>
        <p>FEO s'adresse aux personnes de 13 ans et plus.</p>
      </section>

      <section>
        <h2>Modifications</h2>
        <p>Si cette politique change de façon importante, nous l'indiquerons dans l'application. La date en haut de page indique la dernière version.</p>
      </section>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Conditions d'utilisation">
      <section>
        <p>En créant un compte ou en utilisant FEO, tu acceptes ces conditions. Elles sont courtes : lis-les.</p>
      </section>

      <section>
        <h2>Le service</h2>
        <p>
          FEO est un lecteur de musique gratuit qui s'appuie sur le catalogue de YouTube et sur une intelligence
          artificielle pour te proposer des titres, des playlists et une radio. FEO n'est ni affilié à YouTube ni à Google,
          ni approuvé par eux.
        </p>
      </section>

      <section>
        <h2>Ton compte</h2>
        <ul>
          <li>Tu dois avoir au moins 13 ans.</li>
          <li>Tu es responsable de ton mot de passe et de ce qui se fait avec ton compte. Préviens-nous si tu penses qu'il a été utilisé par quelqu'un d'autre.</li>
          <li>Tu peux supprimer ton compte à tout moment en nous écrivant (voir plus bas).</li>
        </ul>
      </section>

      <section>
        <h2>La musique</h2>
        <p>
          Les titres, clips et pochettes appartiennent à leurs auteurs et ayants droit et sont diffusés depuis YouTube. En
          écoutant de la musique sur FEO, tu acceptes aussi les{' '}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">conditions d'utilisation de YouTube</a>.
          FEO ne permet pas de télécharger la musique : l'écoute est réservée à un usage personnel et non commercial.
        </p>
        <p>
          Un titre peut devenir indisponible à tout moment, par exemple s'il est retiré de YouTube ou que son intégration
          est désactivée. Si tu es ayant droit et qu'un contenu te pose problème, écris-nous.
        </p>
      </section>

      <section>
        <h2>L'intelligence artificielle</h2>
        <p>
          Les playlists, mix et recherches par description sont produits automatiquement. Ils peuvent se tromper : un
          titre mal identifié, une ambiance différente de celle attendue. Ne décris pas d'informations personnelles
          sensibles dans tes demandes à l'IA.
        </p>
      </section>

      <section>
        <h2>Ce qui est interdit</h2>
        <ul>
          <li>Contourner les limites du service, l'automatiser ou le surcharger (robots, extraction massive).</li>
          <li>Tenter d'accéder aux comptes ou aux données d'autres personnes.</li>
          <li>Utiliser FEO pour enfreindre la loi ou les droits d'autrui.</li>
        </ul>
        <p>Nous pouvons suspendre un compte qui ne respecte pas ces règles.</p>
      </section>

      <section>
        <h2>Disponibilité et responsabilité</h2>
        <p>
          FEO est fourni « tel quel », gratuitement, sans garantie de disponibilité permanente. Le service peut évoluer,
          être interrompu pour maintenance ou s'arrêter. Dans les limites permises par la loi, FEO ne peut être tenu
          responsable des dommages indirects liés à son utilisation ou à l'indisponibilité d'un contenu.
        </p>
      </section>

      <section>
        <h2>Tes données</h2>
        <p>Leur traitement est décrit dans la <a href="/privacy">politique de confidentialité</a>.</p>
      </section>

      <section>
        <h2>Modifications et droit applicable</h2>
        <p>
          Nous pouvons mettre à jour ces conditions ; la date en haut de page indique la dernière version et les
          changements importants seront signalés dans l'application. Ces conditions sont régies par le droit malgache.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
      </section>
    </LegalPage>
  );
}
