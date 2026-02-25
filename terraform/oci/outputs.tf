# =============================================================================
# Outputs — Info shown after terraform apply
# =============================================================================

output "vm_public_ip" {
  description = "Public IP of the test VM"
  value       = oci_core_instance.techstore_test.public_ip
}

output "vm_name" {
  description = "Display name of the instance"
  value       = oci_core_instance.techstore_test.display_name
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/oci_test ubuntu@${oci_core_instance.techstore_test.public_ip}"
}

output "image_used" {
  description = "Ubuntu image OCID used"
  value       = data.oci_core_images.ubuntu.images[0].id
}
