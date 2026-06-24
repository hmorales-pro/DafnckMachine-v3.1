# Néora — image tout-en-un (app + navigateur pour les portes QA E2E/Monkey)
FROM node:22-bookworm

WORKDIR /app

# Les navigateurs Playwright sont installés ici ; notre code respecte cette variable.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NEXT_TELEMETRY_DISABLED=1

# Dépendances (devDeps incluses : jscpd, knip et playwright servent au runtime QA)
COPY package.json package-lock.json ./
RUN npm ci

# Navigateur Chromium + librairies système nécessaires aux portes E2E / Monkey
RUN npx playwright install --with-deps chromium

# Code + build de production
COPY . .
RUN npm run build

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
