<?php
// =========================================================================
// STANDALONE PHP CONTACT FORM PROCESSOR
// This script does NOT rely on the external 'php-email-form.php' library.
// It uses standard PHP mail() function and is compatible with your template's 
// front-end validation script (assets/vendor/php-email-form/validate.js).
// =========================================================================

// 1. CONFIGURATION
// ----------------
// !!! IMPORTANT: Replace this with your actual receiving email address !!!
$receiving_email_address = 'richardpblair@gmail.com'; 

// 2. PROCESS SUBMISSION
// ---------------------

// Ensure this script is only processed via a POST request
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(403);
    echo "Access Denied.";
    exit;
}

// Collect and sanitize data from the form
$name    = filter_input(INPUT_POST, 'name', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
$email   = filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL);
$subject = filter_input(INPUT_POST, 'subject', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
$message = filter_input(INPUT_POST, 'message', FILTER_SANITIZE_FULL_SPECIAL_CHARS);

// Simple validation
if (empty($name) || empty($email) || empty($subject) || empty($message) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400); // Bad Request
    echo "Validation failed. Please ensure all fields are filled and the email is valid.";
    exit;
}

// 3. BUILD AND SEND EMAIL
// -----------------------

$to = $receiving_email_address;
$email_subject = "New Contact from Portfolio: " . $subject;

// Email body (plain text format)
$email_body = "You have received a new message from your portfolio contact form.\n\n";
$email_body .= "Name: " . $name . "\n";
$email_body .= "Email: " . $email . "\n";
$email_body .= "Subject: " . $subject . "\n";
$email_body .= "Message:\n" . $message . "\n";

// Email headers
$headers = "From: {$name} <{$email}>\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

// Send the email
if (mail($to, $email_subject, $email_body, $headers)) {
    // Success: The template's JS looks for this exact response to show the 'sent-message'
    http_response_code(200);
    echo "OK"; 
} else {
    // Failure: Internal Server Error or mail function issue
    http_response_code(500); 
    echo "There was an issue sending your message. Please check your PHP mail configuration.";
}
?>