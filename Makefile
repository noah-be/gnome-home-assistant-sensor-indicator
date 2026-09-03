UUID := home-assistant-sensor-indicator@noah-be.github.io
INSTALL_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
DIST_DIR := dist
SOURCES := extension.js format.js metadata.json prefs.js secret.js stylesheet.css schemas

.PHONY: all clean enable install pack test uninstall validate

all: validate

test:
	node tests/test-format.mjs

validate: test
	jq empty metadata.json package.json
	node --check extension.js
	node --check format.js
	node --check prefs.js
	node --check secret.js
	glib-compile-schemas --strict --dry-run schemas

install: validate
	mkdir -p "$(INSTALL_DIR)"
	cp -r $(SOURCES) "$(INSTALL_DIR)/"
	glib-compile-schemas "$(INSTALL_DIR)/schemas"

enable:
	gnome-extensions enable "$(UUID)"

uninstall:
	gnome-extensions disable "$(UUID)" 2>/dev/null || true
	rm -rf "$(INSTALL_DIR)"

pack: validate
	mkdir -p "$(DIST_DIR)"
	gnome-extensions pack --force --out-dir="$(DIST_DIR)" \
		--extra-source=format.js --extra-source=secret.js .

clean:
	rm -rf "$(DIST_DIR)" schemas/gschemas.compiled
