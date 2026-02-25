# =============================================================================
# Variables — OCI Test VM
# =============================================================================

# ── OCI Authentication ────────────────────────────────────
variable "tenancy_ocid" {
  description = "OCID of the OCI tenancy"
  type        = string
}

variable "user_ocid" {
  description = "OCID of the OCI user"
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint of the API key"
  type        = string
}

variable "private_key_path" {
  description = "Path to the OCI API private key (.pem)"
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "region" {
  description = "OCI region identifier (e.g. us-ashburn-1, sa-saopaulo-1)"
  type        = string
}

variable "compartment_ocid" {
  description = "OCID of the compartment (use tenancy OCID for root)"
  type        = string
}

# ── Instance Config ───────────────────────────────────────
variable "instance_name" {
  description = "Display name for the VM"
  type        = string
  default     = "techstore-test"
}

variable "instance_shape" {
  description = "OCI shape (VM.Standard.A1.Flex = ARM64 free tier)"
  type        = string
  default     = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  description = "Number of OCPUs (free tier: up to 4 total across all A1 instances)"
  type        = number
  default     = 1
}

variable "instance_memory_gb" {
  description = "Memory in GB (free tier: up to 24 GB total, 6 GB per OCPU)"
  type        = number
  default     = 6
}

variable "boot_volume_gb" {
  description = "Boot volume size in GB (free tier: up to 200 GB total)"
  type        = number
  default     = 50
}

# ── SSH ───────────────────────────────────────────────────
variable "ssh_pub_key_path" {
  description = "Path to SSH public key for VM access"
  type        = string
  default     = "~/.ssh/oci_test.pub"
}
