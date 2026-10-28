/**
 * Conversation flow engine
 * Manages the step-by-step WhatsApp conversation for each user
 *
 * Each step: receives user input → updates state → sends next message
 */
const { sendText, sendButtons, sendList } = require('./_whatsapp');
const { updateUser, logSession } = require('./_firebase');

// ─── Stratification logic (matches prototype) ───

function stratify(age, exerciseScore, mobilityScore) {
  const isOlder = (age === '65–74' || age === '75+');
  const baseline = isOlder ? 'moderate' : 'mild';

  const score = (mobilityScore ?? 1) + (exerciseScore ?? 1);
  let result;
  if (score <= 1) result = 'mild';
  else if (score <= 3) result = 'moderate';
  else result = 'severe';

  const levels = { mild: 0, moderate: 1, severe: 2 };
  return levels[result] >= levels[baseline] ? result : baseline;
}

// ─── Video URLs (update these with real Google Drive links) ───

const VIDEOS = {
  mild: 'https://drive.google.com/file/d/PLACEHOLDER_MILD/view',
  moderate: 'https://drive.google.com/file/d/PLACEHOLDER_MODERATE/view',
  severe: 'https://drive.google.com/file/d/PLACEHOLDER_SEVERE/view',
};

// ─── Step handlers ───
// Each returns the updated step name after processing

async function handleStep(phone, token, user, inputText, inputButtonId) {
  const step = user.step || 'welcome';
  const input = inputButtonId || inputText || '';

  switch (step) {

    // ──────────────────────────────────────
    // WELCOME
    // ──────────────────────────────────────
    case 'welcome': {
      await sendText(phone,
        '👋 *Welcome to Mzansi Movers!*\n\n' +
        'We\'re a South African non-profit helping people with Parkinson\'s Disease access free, evidence-based exercise therapy.\n\n' +
        'Our programs are based on clinical evidence and adapted to your disease stage. We\'ll send you a personalized video session right here on WhatsApp. 💪\n\n' +
        'This takes about 2 minutes to set up. Ready to start?'
      );
      await sendButtons(phone, 'Tap below to begin:', [
        { id: 'lets_go', title: "Let's go! 🏃" },
      ]);
      await updateUser(token, { step: 'await_start' });
      return;
    }

    // ──────────────────────────────────────
    // TERMS & CONDITIONS
    // ──────────────────────────────────────
    case 'await_start': {
      await sendText(phone,
        'Before we begin, please read and agree to our *Terms & Conditions*:\n\n' +
        '📋 *Medical Disclaimer:* This app provides exercise guidance only — not medical advice. Always consult your healthcare provider first.\n\n' +
        '📋 *Intended Use:* Designed for people with Parkinson\'s Disease in South Africa, stratified by disease severity.\n\n' +
        '📋 *Data Privacy (POPIA):* We collect minimal, anonymised data. No identifiable info is retained. Request deletion any time.\n\n' +
        '📋 *Your Responsibility:* Exercise at your own pace. Stop if you feel pain, dizziness, or discomfort.\n\n' +
        '📋 *Incident Reporting:* Report adverse events to mzansimovers@gmail.com'
      );
      await sendButtons(phone, 'Do you agree to the Terms & Conditions?', [
        { id: 'tcs_agree', title: 'I Agree ✓' },
        { id: 'tcs_decline', title: 'Decline' },
      ]);
      await updateUser(token, { step: 'await_tcs' });
      return;
    }

    case 'await_tcs': {
      if (input === 'tcs_decline') {
        await sendText(phone, 'To use Mzansi Movers, you need to agree to our Terms & Conditions. Please tap *I Agree* when you\'re ready.');
        await sendButtons(phone, 'Do you agree?', [
          { id: 'tcs_agree', title: 'I Agree ✓' },
          { id: 'tcs_decline', title: 'Decline' },
        ]);
        return; // stay on same step
      }
      await updateUser(token, { agreedTcs: true, step: 'await_tcs_done' });
      // Fall through to safety
      await handleStep(phone, token, { ...user, step: 'await_tcs_done' }, '', '');
      return;
    }

    // ──────────────────────────────────────
    // SAFETY ACKNOWLEDGEMENT
    // ──────────────────────────────────────
    case 'await_tcs_done': {
      await sendText(phone,
        '⚠️ *Safety Acknowledgement*\n\n' +
        '*Important safety information:* Exercise with Parkinson\'s Disease can be highly beneficial, but please take these precautions:\n\n' +
        '• Take your Parkinson\'s medication at least 30 minutes before exercising.\n' +
        '• Have a support person nearby whenever possible.\n' +
        '• Exercise in a clear, well-lit area free of tripping hazards.\n' +
        '• Stop immediately if you experience sharp pain, chest tightness, severe dizziness, or difficulty breathing.\n' +
        '• Keep water nearby and stay hydrated.\n\n' +
        'This program provides exercise guidance only and does *not* replace advice from your doctor or healthcare team.'
      );
      await sendButtons(phone, 'I confirm that I have read and understood the safety information above, and I accept responsibility for exercising safely.', [
        { id: 'safety_confirm', title: 'Confirm & Continue' },
      ]);
      await updateUser(token, { step: 'await_safety' });
      return;
    }

    case 'await_safety': {
      await updateUser(token, { agreedSafety: true, step: 'ask_age' });
      await handleStep(phone, token, { ...user, step: 'ask_age' }, '', '');
      return;
    }

    // ──────────────────────────────────────
    // REGISTRATION: AGE
    // ──────────────────────────────────────
    case 'ask_age': {
      await sendButtons(phone, "Great! Let's get you set up. First, which age group are you in?", [
        { id: 'age_under50', title: 'Under 50' },
        { id: 'age_50_64', title: '50–64' },
        { id: 'age_65_74', title: '65–74' },
      ]);
      // WhatsApp only allows 3 buttons — send 75+ as a follow-up or use list
      // Using list instead for 4 options:
      await updateUser(token, { step: 'await_age' });
      return;
    }

    case 'await_age': {
      const ageMap = {
        'age_under50': 'Under 50',
        'age_50_64': '50–64',
        'age_65_74': '65–74',
        'age_75': '75+',
      };
      // Also handle free-text responses
      const age = ageMap[input] || input;
      await updateUser(token, { age, step: 'ask_exercise' });
      await handleStep(phone, token, { ...user, age, step: 'ask_exercise' }, '', '');
      return;
    }

    // ──────────────────────────────────────
    // REGISTRATION: EXERCISE LEVEL
    // ──────────────────────────────────────
    case 'ask_exercise': {
      await sendButtons(phone, 'Got it. How would you describe your current level of physical activity?', [
        { id: 'ex_very', title: 'Very active' },
        { id: 'ex_somewhat', title: 'Somewhat active' },
        { id: 'ex_minimal', title: 'Minimally active' },
      ]);
      await updateUser(token, { step: 'await_exercise' });
      return;
    }

    case 'await_exercise': {
      const exerciseMap = {
        'ex_very': { label: 'Very active', score: 0 },
        'ex_somewhat': { label: 'Somewhat active', score: 1 },
        'ex_minimal': { label: 'Minimally active', score: 2 },
        'ex_not': { label: 'Not active', score: 3 },
      };
      const match = exerciseMap[input] || { label: input, score: 1 };
      await updateUser(token, {
        exercise: match.label,
        exerciseScore: match.score,
        step: 'ask_mobility',
      });
      await handleStep(phone, token, { ...user, exercise: match.label, exerciseScore: match.score, step: 'ask_mobility' }, '', '');
      return;
    }

    // ──────────────────────────────────────
    // REGISTRATION: MOBILITY
    // ──────────────────────────────────────
    case 'ask_mobility': {
      await sendButtons(phone, 'Almost there! How would you describe your current mobility and movement difficulties due to Parkinson\'s?', [
        { id: 'mob_none', title: 'No limitations' },
        { id: 'mob_mild', title: 'Mild limitations' },
        { id: 'mob_mod', title: 'Moderate' },
      ]);
      await updateUser(token, { step: 'await_mobility' });
      return;
    }

    case 'await_mobility': {
      const mobMap = {
        'mob_none': { label: 'No limitations', score: 0 },
        'mob_mild': { label: 'Mild limitations', score: 1 },
        'mob_mod': { label: 'Moderate limitations', score: 2 },
        'mob_sig': { label: 'Significant limitations', score: 3 },
      };
      const match = mobMap[input] || { label: input, score: 1 };
      await updateUser(token, {
        mobility: match.label,
        mobilityScore: match.score,
        step: 'stratify',
      });

      // Stratify immediately
      const group = stratify(
        user.age,
        user.exerciseScore ?? match.score,
        match.score
      );
      await updateUser(token, { group, step: 'show_result' });
      await handleStep(phone, token, { ...user, group, mobilityScore: match.score, step: 'show_result' }, '', '');
      return;
    }

    // ──────────────────────────────────────
    // STRATIFICATION RESULT
    // ──────────────────────────────────────
    case 'show_result': {
      const group = user.group;
      const resultMsg = {
        mild: "Based on your responses, we've matched you to our *Mild Program* — a dynamic session combining HIIT and strength training. 💪",
        moderate: "Based on your responses, we've matched you to our *Moderate Program* — an adapted session with HIIT, balance, and strength exercises. 🧘",
        severe: "Based on your responses, we've matched you to our *Supported Movement Program* — a safe, effective session adapted for greater mobility challenges. 🌟",
      };

      await sendText(phone, 'Processing your information...');
      await sendText(phone, resultMsg[group] || resultMsg.moderate);

      await sendText(phone,
        "⚠️ *Safety reminder:* Take your Parkinson's medication before exercising. " +
        "Have a support person nearby if possible. Stop immediately if you experience sharp pain or severe discomfort."
      );

      await sendButtons(phone, 'Ready for your exercise video?', [
        { id: 'send_video', title: 'Send my video ▶️' },
      ]);
      await updateUser(token, { step: 'await_video_request' });
      return;
    }

    // ──────────────────────────────────────
    // VIDEO
    // ──────────────────────────────────────
    case 'await_video_request': {
      const videoUrl = VIDEOS[user.group] || VIDEOS.moderate;
      await sendText(phone, `Here is your personalized exercise session 👇\n\n${videoUrl}`);
      await sendButtons(phone, 'Tap when you\'re done watching:', [
        { id: 'done_watching', title: 'Done watching ✓' },
      ]);
      await updateUser(token, { step: 'await_done_watching' });
      return;
    }

    // ──────────────────────────────────────
    // FEEDBACK
    // ──────────────────────────────────────
    case 'await_done_watching': {
      await sendText(phone, 'Well done for completing your session! 🎉 Your feedback helps us improve.');
      await sendButtons(phone, 'How would you rate this session?', [
        { id: 'rate_3', title: '⭐⭐⭐ Good' },
        { id: 'rate_4', title: '⭐⭐⭐⭐ Great' },
        { id: 'rate_5', title: '⭐⭐⭐⭐⭐ Excellent' },
      ]);
      await updateUser(token, { step: 'await_rating' });
      return;
    }

    case 'await_rating': {
      const ratingMap = { 'rate_1': 1, 'rate_2': 2, 'rate_3': 3, 'rate_4': 4, 'rate_5': 5 };
      const rating = ratingMap[input] || 4;
      await sendText(phone, `Thank you for your ${rating}-star rating! Your response has been recorded. 📊`);

      // Log the session
      await logSession(token, {
        group: user.group,
        rating,
        age: user.age,
        exercise: user.exercise,
        mobility: user.mobility,
      });

      await updateUser(token, { step: 'ask_schedule' });
      await handleStep(phone, token, { ...user, step: 'ask_schedule' }, '', '');
      return;
    }

    // ──────────────────────────────────────
    // SCHEDULING
    // ──────────────────────────────────────
    case 'ask_schedule': {
      await sendButtons(phone,
        "Regular exercise — 3 to 4 times per week — makes a real difference with Parkinson's. When would you like your next session?",
        [
          { id: 'sched_tomorrow', title: 'Tomorrow' },
          { id: 'sched_2days', title: 'In 2 days' },
          { id: 'sched_week', title: 'Next week' },
        ]
      );
      await updateUser(token, { step: 'await_schedule' });
      return;
    }

    case 'await_schedule': {
      const schedMap = {
        'sched_tomorrow': 'tomorrow',
        'sched_2days': 'in 2 days',
        'sched_week': 'next week',
        'sched_later': 'later',
      };
      const choice = schedMap[input] || input;

      if (choice === 'later') {
        await sendText(phone, "No problem! Just send us a message whenever you're ready and we'll be here. 💚");
      } else {
        await sendText(phone, `Great! We'll send you a reminder *${choice}*. Look out for our message! 💚`);
      }

      await sendText(phone, 'Stay strong, *Mzansi Movers* 🌍');
      await updateUser(token, { step: 'idle', nextSession: choice });
      return;
    }

    // ──────────────────────────────────────
    // RETURNING USER (idle state)
    // ──────────────────────────────────────
    case 'idle': {
      await sendText(phone,
        `Welcome back! 👋\n\n` +
        `Last time you were in our *${(user.group || 'moderate').charAt(0).toUpperCase() + (user.group || 'moderate').slice(1)} Program*.\n\n` +
        `Would you like to start your next session?`
      );
      await sendButtons(phone, 'What would you like to do?', [
        { id: 'start_session', title: "Let's go! 🏃" },
        { id: 'update_profile', title: 'Update my details' },
      ]);
      await updateUser(token, { step: 'await_return_choice' });
      return;
    }

    case 'await_return_choice': {
      if (input === 'update_profile') {
        await updateUser(token, { step: 'ask_age' });
        await handleStep(phone, token, { ...user, step: 'ask_age' }, '', '');
      } else {
        // Returning session — skip registration, show safety reminder + video
        await sendText(phone,
          "⚠️ *Safety reminder:* Take your Parkinson's medication before exercising. " +
          "Have a support person nearby if possible. Stop immediately if you experience sharp pain or severe discomfort."
        );
        await sendButtons(phone, 'Ready for your exercise video?', [
          { id: 'send_video', title: 'Send my video ▶️' },
        ]);
        await updateUser(token, { step: 'await_video_request' });
      }
      return;
    }

    // ──────────────────────────────────────
    // FALLBACK
    // ──────────────────────────────────────
    default: {
      await sendText(phone, "I didn't quite understand that. Send *START* to begin a new session.");
      await updateUser(token, { step: 'welcome' });
      return;
    }
  }
}

module.exports = { handleStep };
