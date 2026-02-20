# =============================================================================
# Main — Recursos de infraestructura en Google Cloud
# =============================================================================
# Este archivo define QUÉ se va a crear:
#   1. Una VM e2-micro (free tier) con Ubuntu 22.04
#   2. Una IP pública estática (para que no cambie al reiniciar)
#   3. Reglas de firewall (abrir puertos HTTP, HTTPS, SSH)
# =============================================================================

# ── Provider: le dice a Terraform que use Google Cloud ────
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  required_version = ">= 1.0"
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ── 1. IP PÚBLICA ESTÁTICA ───────────────────────────────
# Sin esto, la IP cambia cada vez que la VM se reinicia.
resource "google_compute_address" "prod2_ip" {
  name   = "${var.vm_name}-ip"
  region = var.region
}

# ── 2. FIREWALL — Abrir puertos necesarios ───────────────
# SSH (22): para conectarnos y desplegar con Ansible
# HTTP (80): tráfico web (Nginx redirige a HTTPS)
# HTTPS (443): tráfico web seguro
# 5001 (backend) y 5173 (frontend): acceso directo (debug)
resource "google_compute_firewall" "allow_web_ssh" {
  name    = "${var.vm_name}-allow-web-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443", "5001", "5173"]
  }

  # Permitir desde cualquier IP (Cloudflare/usuarios)
  source_ranges = ["0.0.0.0/0"]

  # Aplicar solo a VMs con este tag
  target_tags = ["techstore-server"]
}

# ── 3. VM — La máquina virtual ────────────────────────────
resource "google_compute_instance" "prod2" {
  name         = var.vm_name
  machine_type = var.machine_type
  zone         = var.zone

  # Tags para que el firewall aplique a esta VM
  tags = ["techstore-server"]

  # Disco de arranque con Ubuntu 22.04
  boot_disk {
    initialize_params {
      image = var.os_image
      size  = var.disk_size_gb
      type  = "pd-standard" # Disco estándar (free tier)
    }
  }

  # Red: asignar la IP pública estática
  network_interface {
    network = "default"

    access_config {
      # Asociar la IP estática que creamos arriba
      nat_ip = google_compute_address.prod2_ip.address
    }
  }

  # Metadata: inyectar llave SSH para acceso remoto
  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_pub_key_path)}"
  }

  # Script de inicio: instalar Python (requerido por Ansible)
  metadata_startup_script = <<-EOT
    #!/bin/bash
    # Ansible requiere Python en el servidor remoto
    apt-get update -y
    apt-get install -y python3 python3-apt
  EOT

  # Permitir detener la VM para cambiar tipo de máquina
  allow_stopping_for_update = true
}
