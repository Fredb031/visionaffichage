import { useLocation, useNavigate } from 'react-router-dom';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { label: 'Accueil', path: '/' },
    { label: 'Boutique', path: '/products' },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[450] bg-foreground/95 rounded-full p-[5px] flex gap-0.5 border border-foreground/10 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`text-[12px] px-5 py-2 rounded-full border-none cursor-pointer transition-all font-semibold ${
            location.pathname === item.path
              ? 'bg-primary-foreground/12 text-primary-foreground'
              : 'bg-transparent text-primary-foreground/38 hover:text-primary-foreground/70'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
