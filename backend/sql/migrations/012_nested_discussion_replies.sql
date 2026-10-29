BEGIN;

-- Replies may target any comment, but parent updates must not introduce a cycle.
DROP TRIGGER IF EXISTS trg_discussion_comments_depth ON public.discussion_comments;
DROP FUNCTION IF EXISTS public.enforce_discussion_comment_depth();

CREATE FUNCTION public.enforce_discussion_comment_parent()
RETURNS trigger AS $$
DECLARE
    creates_cycle BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    WITH RECURSIVE ancestors(id, parent_id) AS (
        SELECT c.id, c.parent_id
        FROM public.discussion_comments c
        WHERE c.id = NEW.parent_id
        UNION
        SELECT parent.id, parent.parent_id
        FROM public.discussion_comments parent
        JOIN ancestors child ON parent.id = child.parent_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO creates_cycle;

    IF creates_cycle THEN
        RAISE EXCEPTION 'Bình luận không thể là cha của chính nó.' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_discussion_comments_parent
BEFORE INSERT OR UPDATE OF parent_id ON public.discussion_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_discussion_comment_parent();

COMMIT;