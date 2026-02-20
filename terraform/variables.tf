# =============================================================================
# Variables — Parámetros configurables para la infraestructura
# =============================================================================
# Cada variable tiene un tipo, descripción y valor por defecto.
# Los valores reales se definen en terraform.tfvars
# =============================================================================

# ── Proyecto de Google Cloud ──────────────────────────────
variable "project_id" {
  description = "ID del proyecto en Google Cloud"
  type        = string
}

# ── Región y zona donde crear la VM ───────────────────────
# Free tier e2-micro: us-central1, us-east1, us-west1
variable "region" {
  description = "Región de GCP (elegir una del free tier)"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zona específica dentro de la región"
  type        = string
  default     = "us-central1-a"
}

# ── Configuración de la VM ────────────────────────────────
variable "vm_name" {
  description = "Nombre de la instancia VM"
  type        = string
  default     = "techstore-prod-2"
}

variable "machine_type" {
  description = "Tipo de máquina (e2-micro = free tier)"
  type        = string
  default     = "e2-micro"
}

# ── Sistema operativo ─────────────────────────────────────
variable "os_image" {
  description = "Imagen del SO (familia/proyecto)"
  type        = string
  default     = "ubuntu-2204-lts"
}

# ── SSH ───────────────────────────────────────────────────
variable "ssh_user" {
  description = "Usuario SSH para la VM"
  type        = string
  default     = "ubuntu"
}

variable "ssh_pub_key_path" {
  description = "Ruta a la llave pública SSH"
  type        = string
  default     = "~/.ssh/gcp_prod2.pub"
}

# ── Disco ─────────────────────────────────────────────────
variable "disk_size_gb" {
  description = "Tamaño del disco en GB (free tier: hasta 30GB)"
  type        = number
  default     = 30
}
