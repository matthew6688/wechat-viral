-- Migration: Fix helper count calculation with UnionID deduplication
-- This migration recalculates helper_count for all participants
-- ensuring that users with the same unionid are only counted once

-- Function to recalculate helper count for a single participant
CREATE OR REPLACE FUNCTION recalculate_helper_count(participant_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  unique_count INTEGER;
BEGIN
  -- Count unique helpers by unionid (if available), otherwise by openid
  SELECT COUNT(DISTINCT 
    CASE 
      WHEN helper_unionid IS NOT NULL AND helper_unionid != '' THEN 
        'unionid:' || helper_unionid
      ELSE 
        'openid:' || helper_openid
    END
  ) INTO unique_count
  FROM campaign_helpers
  WHERE campaign_helpers.participant_id = participant_id_param
    AND campaign_helpers.is_valid = true;
  
  -- Update the participant's helper_count
  UPDATE campaign_participants
  SET helper_count = COALESCE(unique_count, 0),
      updated_at = NOW()
  WHERE id = participant_id_param;
  
  RETURN COALESCE(unique_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Recalculate helper counts for all participants
DO $$
DECLARE
  participant_record RECORD;
  fixed_count INTEGER := 0;
  total_participants INTEGER := 0;
BEGIN
  -- Loop through all participants
  FOR participant_record IN 
    SELECT id FROM campaign_participants
  LOOP
    total_participants := total_participants + 1;
    
    -- Recalculate helper count
    PERFORM recalculate_helper_count(participant_record.id);
    
    fixed_count := fixed_count + 1;
    
    -- Log progress every 10 participants
    IF fixed_count % 10 = 0 THEN
      RAISE NOTICE 'Fixed helper counts for % participants...', fixed_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration complete: Fixed helper counts for % participants', total_participants;
END $$;

-- Add index on helper_unionid for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_helpers_unionid 
ON campaign_helpers(helper_unionid) 
WHERE helper_unionid IS NOT NULL;

-- Add composite index for faster deduplication queries
CREATE INDEX IF NOT EXISTS idx_campaign_helpers_participant_unionid 
ON campaign_helpers(participant_id, helper_unionid, is_valid) 
WHERE is_valid = true;

COMMENT ON FUNCTION recalculate_helper_count(UUID) IS 
'Recalculates helper count for a participant, deduplicating by unionid when available';
