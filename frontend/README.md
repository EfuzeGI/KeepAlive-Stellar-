# KeepAlive Frontend

Web interface for the KeepAlive Protocol, built with Next.js 14.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Configuration

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Make sure the Keeper Node URL `NEXT_PUBLIC_KEEPER_URL` is pointing to your active off-chain daemon.
