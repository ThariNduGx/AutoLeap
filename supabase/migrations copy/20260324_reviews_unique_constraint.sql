-- Add unique constraint to prevent duplicate reviews for the same appointment
-- from the same customer. The webhook handler already guards against duplicates
-- with a pre-insert SELECT check; this constraint is the database-level safety net.
ALTER TABLE reviews
  ADD CONSTRAINT reviews_appointment_customer_unique
  UNIQUE (appointment_id, customer_chat_id);
