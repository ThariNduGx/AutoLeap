// CRITICAL: Must be the VERY FIRST LINE before ANY imports
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

// Verify critical env vars are loaded
if (!process.env.DEFAULT_BUSINESS_ID) {
  console.error('❌ DEFAULT_BUSINESS_ID not set in .env.local');
  process.exit(1);
}

if (!process.env.GOOGLE_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error('❌ Neither GOOGLE_API_KEY nor OPENAI_API_KEY is set in .env.local');
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not set in .env.local');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set in .env.local');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log('📍 Using provider:', process.env.USE_GEMINI_FOR_DEV === 'true' ? 'Gemini (dev)' : 'OpenAI');

// NOW import modules that depend on env vars (using dynamic import to ensure env is loaded first)
async function main() {
  const { storeFAQ } = await import('../lib/infrastructure/embeddings');
  
  const BUSINESS_ID = process.env.DEFAULT_BUSINESS_ID!;
  
  const sampleFAQs = [
    {
      question: 'What are your business hours?',
      answer: 'We are open Monday to Saturday from 8:00 AM to 6:00 PM. We are closed on Sundays and public holidays.',
      category: 'general',
    },
    {
      question: 'How much does AC cleaning cost?',
      answer: 'AC cleaning costs Rs. 2,500 for window units and Rs. 8,000-15,000 for centralized systems, depending on the number of units.',
      category: 'pricing',
    },
    {
      question: 'Do you offer emergency services?',
      answer: 'We do not offer after-hours emergency services. For urgent matters, please contact us when we reopen at 8:00 AM.',
      category: 'services',
    },
    {
      question: 'What areas do you cover?',
      answer: 'We provide services in Colombo, Dehiwala, Mount Lavinia, Moratuwa, and surrounding areas within a 15km radius.',
      category: 'services',
    },
    {
      question: 'How long does AC cleaning take?',
      answer: 'Window AC cleaning takes 1-2 hours. Centralized AC cleaning takes 3-4 hours depending on the number of units.',
      category: 'services',
    },
    {
      question: 'Do I need to be home during the service?',
      answer: 'Yes, someone must be present during the service to provide access and answer any questions our technician may have.',
      category: 'general',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept cash, bank transfer, and mobile payments (PromptPay, FriMi). Payment is due upon completion of service.',
      category: 'payment',
    },
    {
      question: 'Can I reschedule my appointment?',
      answer: 'Yes, you can reschedule up to 24 hours before your appointment by contacting us. Same-day reschedules may not be possible.',
      category: 'booking',
    },
  ];

  console.log('🌱 Seeding FAQs for business:', BUSINESS_ID);
  
  let successCount = 0;
  
  for (const faq of sampleFAQs) {
    const success = await storeFAQ(
      BUSINESS_ID,
      faq.question,
      faq.answer,
      faq.category
    );
    
    if (success) {
      successCount++;
      console.log('✅', faq.question);
    } else {
      console.error('❌ Failed:', faq.question);
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ Seeded ${successCount}/${sampleFAQs.length} FAQs`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});