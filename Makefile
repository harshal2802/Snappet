FRONTEND := src/frontend

.PHONY: install dev build preview clean

install:
	cd $(FRONTEND) && npm install

dev:
	cd $(FRONTEND) && npm run dev

build:
	cd $(FRONTEND) && npm run build

preview:
	cd $(FRONTEND) && npm run preview

clean:
	rm -rf $(FRONTEND)/dist $(FRONTEND)/node_modules
