# =============================================================================
# Outputs — Datos que Terraform muestra al terminar
# =============================================================================
# Estos valores los necesitarás para:
#   - Conectarte por SSH
#   - Agregar la VM al inventory de Ansible
#   - Configurar DNS en Cloudflare
# =============================================================================

# ── IP pública de la VM ───────────────────────────────────
output "vm_ip" {
  description = "IP pública estática de la VM prod-2"
  value       = google_compute_address.prod2_ip.address
}

# ── Nombre de la VM ───────────────────────────────────────
output "vm_name" {
  description = "Nombre de la instancia en GCP"
  value       = google_compute_instance.prod2.name
}

# ── Comando SSH para conectarte ───────────────────────────
output "ssh_command" {
  description = "Comando para conectar por SSH"
  value       = "ssh -i ~/.ssh/gcp_prod2 ${var.ssh_user}@${google_compute_address.prod2_ip.address}"
}

# ── Bloque para agregar a Ansible inventory ───────────────
output "ansible_inventory_entry" {
  description = "Entrada para agregar a ansible/inventory.yml"
  value       = <<-EOT
    prod-2:
      ansible_host: ${google_compute_address.prod2_ip.address}
      ansible_user: ${var.ssh_user}
      ansible_ssh_private_key_file: ~/.ssh/gcp_prod2
      domain: prod2.eonsclover.com
      ssl_mode: flexible
      app_branch: main
  EOT
}
