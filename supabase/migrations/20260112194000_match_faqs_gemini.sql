
-- Function to match FAQs using Gemini embeddings (768 dimensions)
create or replace function match_faqs_gemini (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_business_id uuid
)
returns table (
  id uuid,
  question text,
  answer text,
  similarity float
)
language plpgsql
as $$
begin
  if to_regclass('public.faq_documents') is null
     or to_regclass('public.faq_embeddings') is null then
    return;
  end if;

  return query execute $sql$
    select
      d.id,
      d.question,
      d.answer,
      1 - (e.embedding_gemini <=> $1) as similarity
    from public.faq_documents d
    join public.faq_embeddings e on d.id = e.faq_id
    where d.business_id = $2
      and 1 - (e.embedding_gemini <=> $1) > $3
    order by similarity desc
    limit $4
  $sql$
  using query_embedding, p_business_id, match_threshold, match_count;
end;
$$;
