-- Migration 028: Fix MESSAGE_SENT feed trigger to include recipient info
-- The message_feed_trigger currently doesn't populate related_agent_id or related_agent_name

-- Drop old message trigger that uses the generic create_feed_event()
DROP TRIGGER IF EXISTS message_feed_trigger ON messages;

-- Create a dedicated message feed event function (matches pattern from 009)
CREATE OR REPLACE FUNCTION create_message_feed_event()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  recipient_name TEXT;
BEGIN
  -- Only create feed events for public messages
  IF NEW.is_public = true THEN
    -- Look up sender name
    SELECT name INTO sender_name FROM agents WHERE id = NEW.from_agent_id;

    -- Look up recipient name (may be null for broadcasts)
    IF NEW.to_agent_id IS NOT NULL THEN
      SELECT name INTO recipient_name FROM agents WHERE id = NEW.to_agent_id;
    END IF;

    INSERT INTO feed_events (
      event_type, agent_id, agent_name, related_agent_id, related_agent_name,
      description, metadata
    ) VALUES (
      'MESSAGE_SENT',
      NEW.from_agent_id,
      sender_name,
      NEW.to_agent_id,
      recipient_name,
      LEFT(NEW.content, 200),
      jsonb_build_object('message_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the new trigger
CREATE TRIGGER message_feed_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION create_message_feed_event();
