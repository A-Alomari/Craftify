# Craftify
## ITCS489 Project / E-commerce Website for Local Artisans
This project aims to develop a user-friendly e-commerce platform that connects local artisans with customers who value handmade, unique, and culturally rich products. The website provides artisans with a digital marketplace to showcase and sell their crafts, while offering customers a reliable, secure, and enjoyable shopping experience. An administrator oversees the platform to ensure smooth operations, quality control, and security.

## NestJS Runtime

The active application runtime is NestJS (TypeScript) from `src/`.

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Install dependencies:
	- `npm install`
2. Create environment file:
	- Copy `.env.example` to `.env`
3. Build the app:
	- `npm run build`
4. Seed the database:
	- `npm run seed`

### Run

- Development: `npm run dev`
- Production build start: `npm run start`

### Tests

- All tests: `npm test`
- Coverage: `npm run test:coverage`
- Controllers only: `npm run test:controllers`
- Models/services only: `npm run test:models`
- Views/e2e only: `npm run test:views`

### Environment Notes

- `DB_PATH` is the primary SQLite path variable.
- `CRAFTIFY_DB_PATH` remains supported for backward compatibility.
