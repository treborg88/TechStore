# =============================================================================
# TechStore — Oracle Cloud Infrastructure (OCI) — Test VM
# =============================================================================
# Creates an ARM64 VM (Ampere A1) on OCI Always Free tier for testing
# the Docker + PostgreSQL deployment.
#
# Resources created:
#   1. VCN (Virtual Cloud Network) + public subnet
#   2. Internet Gateway + route table
#   3. Security List (SSH, HTTP, HTTPS, backend, frontend)
#   4. VM.Standard.A1.Flex (1 OCPU + 6 GB RAM)
#   5. Public IP (ephemeral, attached to the VNIC)
#
# Usage:
#   cd terraform/oci
#   terraform init
#   terraform plan
#   terraform apply
#   terraform destroy   # cleanup when done
# =============================================================================

terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
  required_version = ">= 1.0"
}

# ── Provider — authenticates via ~/.oci/config ────────────
provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# ── Data: Availability Domain ─────────────────────────────
# OCI requires specifying an AD; free tier ARM is AD-specific.
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

# ── Data: Latest Ubuntu 22.04 aarch64 image ──────────────
# Canonical publishes official images in OCI marketplace.
data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# =============================================================================
# 1. NETWORKING — VCN + Subnet + IGW
# =============================================================================

# ── Virtual Cloud Network ─────────────────────────────────
resource "oci_core_vcn" "techstore_vcn" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.instance_name}-vcn"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "techstorevcn"
}

# ── Internet Gateway (allows outbound + inbound traffic) ──
resource "oci_core_internet_gateway" "igw" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.techstore_vcn.id
  display_name   = "${var.instance_name}-igw"
  enabled        = true
}

# ── Route Table — send 0.0.0.0/0 through IGW ─────────────
resource "oci_core_route_table" "public_rt" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.techstore_vcn.id
  display_name   = "${var.instance_name}-public-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.igw.id
  }
}

# ── Security List — open SSH + web ports ──────────────────
resource "oci_core_security_list" "public_sl" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.techstore_vcn.id
  display_name   = "${var.instance_name}-public-sl"

  # Allow all outbound
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  # SSH (22)
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }

  # HTTP (80)
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  # HTTPS (443)
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }

  # Backend direct (5001) — for debug
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 5001
      max = 5001
    }
  }

  # Frontend direct (5173) — for debug
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 5173
      max = 5173
    }
  }
}

# ── Public Subnet ─────────────────────────────────────────
resource "oci_core_subnet" "public_subnet" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.techstore_vcn.id
  cidr_block                 = "10.0.1.0/24"
  display_name               = "${var.instance_name}-public-subnet"
  dns_label                  = "pubsubnet"
  route_table_id             = oci_core_route_table.public_rt.id
  security_list_ids          = [oci_core_security_list.public_sl.id]
  prohibit_public_ip_on_vnic = false
}

# =============================================================================
# 2. COMPUTE — ARM64 VM (Ampere A1)
# =============================================================================

resource "oci_core_instance" "techstore_test" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = var.instance_name
  shape               = var.instance_shape

  # Flex shape config: 1 OCPU + 6 GB RAM
  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gb
  }

  # Boot volume: Ubuntu 22.04 ARM64, 50 GB
  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_gb
  }

  # Network: public subnet with auto-assigned public IP
  create_vnic_details {
    subnet_id        = oci_core_subnet.public_subnet.id
    assign_public_ip = true
    display_name     = "${var.instance_name}-vnic"
  }

  # SSH key for remote access
  metadata = {
    ssh_authorized_keys = file(var.ssh_pub_key_path)
  }

  # Preserve boot volume on termination (can recover data)
  preserve_boot_volume = false
}
