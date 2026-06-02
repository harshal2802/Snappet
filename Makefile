FRONTEND := src/frontend

.PHONY: install dev build preview clean kg-screenshots

install:
	cd $(FRONTEND) && npm install

# Render the knowledge-graph screenshots (docs/screenshots/) from the live data.js.
kg-screenshots:
	npm --prefix $(FRONTEND) install --no-save @resvg/resvg-js
	node scripts/render-knowledge-graph.mjs

dev:
	cd $(FRONTEND) && npm run dev

build:
	cd $(FRONTEND) && npm run build

preview:
	cd $(FRONTEND) && npm run preview

clean:
	rm -rf $(FRONTEND)/dist $(FRONTEND)/node_modules
