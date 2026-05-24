import Link from 'next/link';
import { Marquee } from '@/components/Marquee';

export const metadata = {
  title: 'Notre démarche — ILU SHOP',
  description:
    "ILU SHOP, c'est une sélection humaine de mode et de tech pour Kinshasa et le Congo. Découvrez notre histoire et nos valeurs.",
};

export default function AProposPage() {
  return (
    <>
      {/* ━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━ */}
      <section className="bg-cream pt-16 pb-0 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="font-display text-[11px] font-semibold tracking-[0.4em] text-terra uppercase">
              ◯ Notre histoire
            </span>
            <h1 className="mt-6 font-display font-extrabold text-ink leading-[0.88] tracking-tight text-[clamp(56px,8vw,112px)]">
              MADE
              <br />
              IN <span className="text-terra">KIN.</span>
            </h1>
            <p className="mt-8 text-lg font-light text-ink/70 max-w-xl leading-relaxed">
              ILU SHOP, c&apos;est l&apos;idée simple que les gens de Kinshasa — et du Congo en
              général — méritent une boutique qui leur parle vraiment. Pas un formulaire froid,
              pas un tunnel de paiement compliqué. Une conversation, une confiance, une livraison.
            </p>
          </div>
        </div>
      </section>

      <Marquee
        items={['Notre démarche', 'Mode & Tech', 'ILU SHOP', 'Kinshasa', 'Made with ♥']}
      />

      {/* ━━━━━━━━━━━━━ VALEURS ━━━━━━━━━━━━━ */}
      <section className="py-24 bg-bone">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="mb-16">
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
              — Ce qui nous définit
            </span>
            <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl text-ink">
              Nos valeurs<span className="text-terra">.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ValueCard
              icon="◯"
              title="Sélection humaine"
              desc="Chaque produit est choisi à la main. Pas d'algorithme, pas de vrac — une équipe qui teste, valide et assume ses coups de cœur."
            />
            <ValueCard
              icon="✦"
              title="Bi-devise"
              desc="USD et CDF côte à côte, taux mis à jour quotidiennement par notre équipe. Vous payez dans la monnaie qui vous convient."
            />
            <ValueCard
              icon="□"
              title="Livraison RDC"
              desc="Kinshasa sous 24h. Pour le reste du pays, on s'entend ensemble. Pas de frais cachés, pas de mauvaises surprises."
            />
            <ValueCard
              icon="△"
              title="Chat d'abord"
              desc="Vous avez une question, une demande spéciale, un doute sur une taille ? On vous répond, on ne vous redirige pas vers une FAQ."
            />
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ MANIFESTO ━━━━━━━━━━━━━ */}
      <section className="bg-ink text-cream py-28 md:py-36 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-gold font-semibold">
              ◯ Manifesto
            </span>
            <h2 className="mt-6 font-display font-extrabold text-5xl md:text-7xl leading-[0.92]">
              Chaque pièce
              <br />
              <span className="text-terra-light">a une histoire.</span>
            </h2>
            <p className="mt-8 text-cream/65 font-light max-w-md leading-relaxed">
              On a créé ILU SHOP parce qu&apos;on en avait assez des boutiques en ligne congolaises
              qui disparaissent après la vente. Ici, on est là avant, pendant et après. On
              répond à vos messages, on suit votre commande avec vous, et si quelque chose ne va
              pas — on arrange ça.
            </p>
            <p className="mt-4 text-cream/65 font-light max-w-md leading-relaxed">
              ILU, en lingala, c&apos;est &quot;amour&quot;. C&apos;est ça qu&apos;on met dans
              chaque colis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <StatRow label="Produits en catalogue" value="450+" />
            <div className="w-full h-px bg-cream/10" />
            <StatRow label="Livraison Kinshasa" value="24h" />
            <div className="w-full h-px bg-cream/10" />
            <StatRow label="Devises supportées" value="USD & FC" />
            <div className="w-full h-px bg-cream/10" />
            <StatRow label="Modes de paiement" value="5+" />
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ APPROCHE ━━━━━━━━━━━━━ */}
      <section className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="font-display text-[10px] tracking-[0.35em] uppercase text-terra font-semibold">
              — Notre approche
            </span>
            <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl text-ink">
              Comment ça marche<span className="text-terra">?</span>
            </h2>
            <p className="mt-4 text-muted font-light">
              De votre première visite à la livraison, voici ce que vous pouvez attendre de nous.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              step="01"
              title="Vous explorez"
              desc="Parcourez le catalogue Mode & Tech. Filtrez par catégorie, prix, popularité. Tout est affiché en USD et en CDF."
            />
            <StepCard
              step="02"
              title="Vous commandez"
              desc="Ajoutez au panier et ouvrez le chat de commande. On confirme la disponibilité, la taille, la couleur — ensemble."
            />
            <StepCard
              step="03"
              title="On livre"
              desc="Paiement par M-Pesa, Airtel Money, Orange Money, virement ou cash à la livraison. Kinshasa sous 24h."
            />
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ CONTACT / CTA ━━━━━━━━━━━━━ */}
      <section className="py-24 bg-terra text-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 text-center">
          <span className="font-display text-[10px] tracking-[0.4em] uppercase text-cream/60 font-semibold">
            ◯ On est là
          </span>
          <h2 className="mt-4 font-display font-extrabold text-4xl md:text-6xl leading-[0.95]">
            Une question ?<br />
            <span className="text-cream/70">On répond.</span>
          </h2>
          <p className="mt-6 text-cream/70 font-light max-w-md mx-auto leading-relaxed">
            Pas de bot, pas de FAQ en boucle. Un vrai membre de l&apos;équipe ILU SHOP vous
            répond dans le chat.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-3 bg-cream text-ink hover:bg-bone font-display text-xs font-semibold tracking-[0.25em] uppercase px-8 py-4 rounded-full transition-colors duration-300 group"
            >
              Découvrir le catalogue
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-3 border border-cream/40 text-cream hover:border-cream font-display text-xs font-semibold tracking-[0.25em] uppercase px-8 py-4 rounded-full transition-colors duration-300"
            >
              Ouvrir le chat
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function ValueCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-cream border border-line rounded-xl p-7 flex flex-col gap-4">
      <span className="text-3xl text-terra">{icon}</span>
      <h3 className="font-display font-bold text-lg text-ink">{title}</h3>
      <p className="text-sm font-light text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-display text-[11px] tracking-widest uppercase text-cream/50">
        {label}
      </span>
      <span className="font-display font-extrabold text-2xl text-cream">{value}</span>
    </div>
  );
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-display text-[48px] font-extrabold text-terra/20 leading-none">
        {step}
      </div>
      <h3 className="font-display font-bold text-xl text-ink">{title}</h3>
      <p className="text-sm font-light text-muted leading-relaxed">{desc}</p>
    </div>
  );
}
