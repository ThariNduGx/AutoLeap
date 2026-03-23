
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
  return query
  select
    d.id,
    d.question,
    d.answer,
    1 - (e.embedding_gemini <=> query_embedding) as similarity
  from faq_documents d
  join faq_embeddings e on d.id = e.faq_id
  where d.business_id = p_business_id
  and 1 - (e.embedding_gemini <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
