import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? 'Vision Affichage';
  const subtitle =
    searchParams.get('subtitle') ?? "Vêtements d'entreprise au Québec";

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#101114',
          color: '#FFFFFF',
          padding: 96,
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: '#35556D',
            textTransform: 'uppercase',
            letterSpacing: 4,
            marginBottom: 24,
          }}
        >
          VISION AFFICHAGE
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 24,
            maxWidth: 1000,
            display: 'flex',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#D9D1C3',
            maxWidth: 900,
            display: 'flex',
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 96,
            fontSize: 20,
            color: '#7A7368',
          }}
        >
          visionaffichage.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
