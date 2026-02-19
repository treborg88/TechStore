# =============================================================================
# Makefile — Ansible shortcuts for TechStore
# =============================================================================
# Simplifica los comandos de Ansible a atajos cortos y memorables.
#
# Uso: make <comando>
# Ejemplo: make deploy-prod
# =============================================================================

# ── Variables ──────────────────────────────────────────────
INVENTORY  = ansible/inventory.yml
PLAYBOOK   = ansible/playbook.yml
MAINT      = ansible/maintenance.yml
ANSIBLE    = ansible-playbook -i $(INVENTORY)

# ═══════════════════════════════════════════════════════════
# DEPLOY
# ═══════════════════════════════════════════════════════════

## Deploy a producción (solo deploy, no setup)
deploy-prod:
	$(ANSIBLE) $(PLAYBOOK) --tags deploy --limit production

## Deploy a staging
deploy-staging:
	$(ANSIBLE) $(PLAYBOOK) --tags deploy --limit staging

## Deploy a todos los servidores
deploy-all:
	$(ANSIBLE) $(PLAYBOOK) --tags deploy

## Setup completo + deploy (primera vez en un server nuevo)
setup-prod:
	$(ANSIBLE) $(PLAYBOOK) --limit production

## Setup completo staging
setup-staging:
	$(ANSIBLE) $(PLAYBOOK) --limit staging

## Dry run — ver qué cambiaría sin ejecutar nada
dry-run:
	$(ANSIBLE) $(PLAYBOOK) --tags deploy --check --diff --limit production

# ═══════════════════════════════════════════════════════════
# MANTENIMIENTO
# ═══════════════════════════════════════════════════════════

## Reiniciar PM2 en producción
restart-prod:
	$(ANSIBLE) $(MAINT) --tags restart --limit production

## Reiniciar solo backend
restart-backend:
	$(ANSIBLE) $(MAINT) --tags restart-backend --limit production

## Reiniciar solo frontend
restart-frontend:
	$(ANSIBLE) $(MAINT) --tags restart-frontend --limit production

## Ver logs del backend
logs-prod:
	$(ANSIBLE) $(MAINT) --tags logs --limit production

## Ver solo logs de errores
logs-errors:
	$(ANSIBLE) $(MAINT) --tags logs-errors --limit production

## Health check completo
health-prod:
	$(ANSIBLE) $(MAINT) --tags health --limit production

## Health check en todos los servers
health-all:
	$(ANSIBLE) $(MAINT) --tags health

## Estado rápido (PM2 + Nginx)
status-prod:
	$(ANSIBLE) $(MAINT) --tags status --limit production

## Limpiar logs y cache
cleanup-prod:
	$(ANSIBLE) $(MAINT) --tags cleanup --limit production

## Backup de configs
backup-prod:
	$(ANSIBLE) $(MAINT) --tags backup --limit production

## Actualizar dependencias npm
update-deps-prod:
	$(ANSIBLE) $(MAINT) --tags update-deps --limit production

## Actualizar paquetes del OS
system-update-prod:
	$(ANSIBLE) $(MAINT) --tags system-update --limit production

## Recargar Nginx
nginx-reload-prod:
	$(ANSIBLE) $(MAINT) --tags nginx-reload --limit production

## Reiniciar servidor (cuidado!)
reboot-prod:
	@echo "⚠️  Esto va a reiniciar el servidor de producción!"
	@read -p "¿Continuar? (y/N) " confirm && [ "$$confirm" = "y" ] || exit 1
	$(ANSIBLE) $(MAINT) --tags reboot --limit production

# ═══════════════════════════════════════════════════════════
# ROLLBACK
# ═══════════════════════════════════════════════════════════

## Rollback a un commit específico: make rollback COMMIT=abc1234
rollback:
	@if [ -z "$(COMMIT)" ]; then \
		echo "Error: especifica el commit → make rollback COMMIT=abc1234"; \
		exit 1; \
	fi
	$(ANSIBLE) $(MAINT) --tags rollback --limit production \
		-e "rollback_commit=$(COMMIT)"

# ═══════════════════════════════════════════════════════════
# CONECTIVIDAD
# ═══════════════════════════════════════════════════════════

## Ping a todos los servidores
ping:
	ansible all -i $(INVENTORY) -m ping

## Ping solo producción
ping-prod:
	ansible production -i $(INVENTORY) -m ping

## Info del servidor
facts-prod:
	ansible production -i $(INVENTORY) -m setup -a "filter=ansible_distribution,ansible_memtotal_mb,ansible_processor_vcpus"

# ═══════════════════════════════════════════════════════════
# VAULT (SECRETOS)
# ═══════════════════════════════════════════════════════════

## Crear archivo de secretos encriptado
vault-create:
	ansible-vault create ansible/vars/secrets.yml

## Editar secretos
vault-edit:
	ansible-vault edit ansible/vars/secrets.yml

## Ver secretos (desencriptar temporalmente)
vault-view:
	ansible-vault view ansible/vars/secrets.yml

# ═══════════════════════════════════════════════════════════
# UTILIDADES
# ═══════════════════════════════════════════════════════════

## Ver comandos disponibles
help:
	@echo ""
	@echo "═══════════════════════════════════════════════════"
	@echo "  TechStore — Comandos Ansible"
	@echo "═══════════════════════════════════════════════════"
	@echo ""
	@echo "  DEPLOY:"
	@echo "    make deploy-prod        Deploy a producción"
	@echo "    make deploy-staging     Deploy a staging"
	@echo "    make deploy-all         Deploy a todos"
	@echo "    make setup-prod         Setup completo (primera vez)"
	@echo "    make dry-run            Simular deploy sin ejecutar"
	@echo ""
	@echo "  MANTENIMIENTO:"
	@echo "    make restart-prod       Reiniciar PM2"
	@echo "    make restart-backend    Reiniciar solo backend"
	@echo "    make restart-frontend   Reiniciar solo frontend"
	@echo "    make logs-prod          Ver logs del backend"
	@echo "    make logs-errors        Ver logs de errores"
	@echo "    make health-prod        Health check completo"
	@echo "    make status-prod        Estado PM2 + Nginx"
	@echo "    make cleanup-prod       Limpiar logs y cache"
	@echo "    make backup-prod        Backup de configs"
	@echo "    make update-deps-prod   Actualizar npm deps"
	@echo "    make nginx-reload-prod  Recargar Nginx"
	@echo "    make system-update-prod Actualizar OS"
	@echo "    make reboot-prod        Reiniciar servidor"
	@echo ""
	@echo "  ROLLBACK:"
	@echo "    make rollback COMMIT=abc1234"
	@echo ""
	@echo "  CONECTIVIDAD:"
	@echo "    make ping               Ping a todos"
	@echo "    make ping-prod          Ping a producción"
	@echo "    make facts-prod         Info del servidor"
	@echo ""
	@echo "  VAULT:"
	@echo "    make vault-create       Crear secretos"
	@echo "    make vault-edit         Editar secretos"
	@echo "    make vault-view         Ver secretos"
	@echo ""

.PHONY: deploy-prod deploy-staging deploy-all setup-prod setup-staging dry-run \
        restart-prod restart-backend restart-frontend logs-prod logs-errors \
        health-prod health-all status-prod cleanup-prod backup-prod \
        update-deps-prod system-update-prod nginx-reload-prod reboot-prod \
        rollback ping ping-prod facts-prod vault-create vault-edit vault-view help
.DEFAULT_GOAL := help
