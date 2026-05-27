import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-ink text-cream/80 mt-32">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 lg:gap-16">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-baseline gap-2">
              <span className="font-display font-extrabold text-3xl tracking-[0.18em] text-terra">
                ILU
              </span>
              <span className="font-display font-extrabold text-3xl tracking-[0.18em] text-cream">
                SHOP.
              </span>
            </div>
            <p className="mt-6 text-sm font-light text-cream/60 max-w-xs leading-relaxed">
              I Love You Shop. Mode & High-Tech. Sélection éditoriale, paiement convenu, livraison
              partout en RDC.
            </p>

            <div className="mt-10">
              <span className="font-display text-[10px] font-semibold tracking-[0.3em] text-cream/40 uppercase">
                Newsletter
              </span>
              <form className="mt-3 flex items-center border-b border-cream/20 pb-2">
                <input
                  type="email"
                  placeholder="votre@email.com"
                  className="flex-1 bg-transparent text-sm placeholder:text-cream/30 text-cream outline-none py-2"
                />
                <button
                  type="submit"
                  className="font-display text-[11px] font-semibold tracking-widest uppercase text-terra hover:text-terra-light transition-colors"
                >
                  S'inscrire →
                </button>
              </form>
            </div>
          </div>

          <FooterColumn
            title="Catalogue"
            links={[
              { href: '/catalogue?cat=mode',        label: 'Mode' },
              { href: '/catalogue?cat=technologie',  label: 'Technologie' },
              { href: '/catalogue?cat=hybrides',     label: 'Wearables' },
              { href: '/catalogue?cat=services',     label: 'Services digitaux' },
              { href: '/#featured',                  label: 'À la une' },
            ]}
          />

          <FooterColumn
            title="Aide"
            links={[
              { href: '#', label: 'Commander' },
              { href: '#', label: 'Livraison' },
              { href: '#', label: 'Paiement' },
              { href: '#', label: 'FAQ' },
              { href: '#', label: 'Contact' },
            ]}
          />

          <FooterColumn
            title="Société"
            links={[
              { href: '#', label: 'À propos' },
              { href: '#', label: 'Notre histoire' },
              { href: '#', label: 'Boutique' },
              { href: '#', label: 'Carrières' },
            ]}
          />

          <FooterColumn
            title="Légal"
            links={[
              { href: '#', label: 'Confidentialité' },
              { href: '#', label: 'CGU' },
              { href: '#', label: 'Cookies' },
              { href: '#', label: 'RGPD' },
            ]}
          />
        </div>

        {/* Bottom */}
        <div className="mt-20 pt-8 border-t border-cream/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="font-light text-xs text-cream/40">
            © 2026 ILU SHOP — Kinshasa, RDC. Tous droits réservés.
          </div>
          <div className="flex items-center gap-6 text-xs">
            <span className="text-cream/40">Modes de paiement convenus en chat :</span>
            <div className="flex items-center gap-3 text-cream/70">
              <PayBadge>M-Pesa</PayBadge>
              <PayBadge>Airtel Money</PayBadge>
              <PayBadge>Orange Money</PayBadge>
              <PayBadge>Cash</PayBadge>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="font-display text-[10px] font-semibold tracking-[0.3em] text-cream/40 uppercase mb-5">
        {title}
      </h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm font-light text-cream/70 hover:text-terra-light transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PayBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded border border-cream/15">
      {children}
    </span>
  );
}
