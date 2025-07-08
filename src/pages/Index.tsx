import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WebcamFeed from '@/components/WebcamFeed';
import VoteChart from '@/components/VoteChart';
import ChatInterface from '@/components/ChatInterface';
import QuestionDisplay from '@/components/QuestionDisplay';
import InfoDisplay from '@/components/InfoDisplay';
import { dataService } from '@/services/dataService';
import HelpDialog from '@/components/HelpDialog';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';

const SECURITY_INFOS = [
  "36% of Americans use a password manager.",
  "81% of data breaches are caused by weak or reused passwords.",
  "Only 10% of people use two-factor authentication on all accounts.",
  "Public WiFi can expose your data to attackers—use a VPN for safety.",
  "Regularly updating software helps protect against security vulnerabilities.",
  "Back up your important files to avoid data loss from ransomware.",
  "Never share your login credentials, even with close friends.",
  "Think before you click: phishing emails can look very convincing."
];

const SECURITY_QUESTIONS = [
  "Do you reuse the same password across multiple accounts?",
  "Have you enabled two-factor authentication on your main email?",
  "Do you use your fingerprint to unlock your phone?",
  "Would you click a link in an unexpected email from your bank?",
  "Do you regularly update your software when prompted?",
  "Would you connect to free public WiFi for online banking?",
  "Do you backup your important files regularly?",
  "Would you share your login credentials with a close friend?"
];

const Info_DURATION_MS = 5000; //15000;
const QUESTION_DURATION_MS = 5000; //45000;
const RESULTS_DURATION_MS = 5000; //60000;

const PHASES = {
  INFO: "info",
  QUESTION: "question",
  RESULTS: "results",
} as const;
type Phase = typeof PHASES[keyof typeof PHASES];

const Index = () => {
  const [currentInfo, setCurrentInfo] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [votes, setVotes] = useState({ yes: 0, no: 0 });
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [fps, setFps] = useState(30);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_DURATION_MS / 1000);
  const [timeRemainingInfo, setTimeRemainingInfo] = useState(Info_DURATION_MS / 1000);
  const [sessionStats, setSessionStats] = useState(dataService.getSessionStats());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(PHASES.INFO);
  
  // Track which face IDs have voted for which questions (persisted across question changes)
  const faceVotesRef = useRef<Record<number, Set<number>>>({});

  // Rotate questions every 45s
  useEffect(() => {
    const interval = setInterval(() => {
      const nextQuestion = (currentQuestion + 1) % SECURITY_QUESTIONS.length;
      setCurrentQuestion(nextQuestion);
      dataService.setCurrentQuestion(nextQuestion);

      const questionVotes = dataService.getVotesForQuestion(nextQuestion);
      setVotes(questionVotes);

      setSessionStats(dataService.getSessionStats());
      
      console.log(`Switched to question ${nextQuestion + 1}: "${SECURITY_QUESTIONS[nextQuestion]}"`);
    }, 45000);

    return () => clearInterval(interval);
  }, [currentQuestion]);

  // Timer logic for phase transitions
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (phase === PHASES.INFO) {
      timeout = setTimeout(() => setPhase(PHASES.QUESTION), Info_DURATION_MS);
    } else if (phase === PHASES.QUESTION) {
      timeout = setTimeout(() => setPhase(PHASES.RESULTS), QUESTION_DURATION_MS);
    } else if (phase === PHASES.RESULTS) {
      timeout = setTimeout(() => {
        // Next info, next question
        const nextInfo = (currentInfo + 1) % SECURITY_INFOS.length;
        setCurrentInfo(nextInfo);
        const nextQuestion = (currentQuestion + 1) % SECURITY_QUESTIONS.length;
        setCurrentQuestion(nextQuestion);
        setPhase(PHASES.INFO);
      }, RESULTS_DURATION_MS);
    }
    return () => clearTimeout(timeout);
  }, [phase, currentInfo, currentQuestion]);

  // Countdown timer for current info display
  useEffect(() => {
    if (phase === PHASES.INFO) {
      setTimeRemainingInfo(Info_DURATION_MS / 1000);
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, Info_DURATION_MS - elapsed);
        setTimeRemainingInfo(Math.ceil(remaining / 1000));
      };
      tick();
      const t = setInterval(tick, 1000);
      return () => clearInterval(t);
    }
  }, [phase, currentInfo]);

  // Countdown timer for current question
  useEffect(() => {
    if (phase === PHASES.QUESTION) {
      setTimeRemaining(QUESTION_DURATION_MS / 1000);
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, QUESTION_DURATION_MS - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));
      };
      tick();
      const t = setInterval(tick, 1000);
      return () => clearInterval(t);
    }
  }, [phase, currentQuestion]);

  // -----------------------------------------
  // 1) Memoized Callback: handleGestureDetected
  // -----------------------------------------
  const handleGestureDetected = useCallback((gesture: 'yes' | 'no', faceId: number) => {
    console.log(`Gesture detected: Face ${faceId} voted ${gesture} for question ${currentQuestion + 1}`);
    
    // Initialize vote tracking for this question if not exists
    if (!faceVotesRef.current[currentQuestion]) {
      faceVotesRef.current[currentQuestion] = new Set();
    }
    
    // Check if this face has already voted for this question
    if (faceVotesRef.current[currentQuestion].has(faceId)) {
      console.log(`Face ${faceId} has already voted for question ${currentQuestion + 1}, ignoring duplicate vote`);
      return;
    }
    
    // Record that this face has voted for this question
    faceVotesRef.current[currentQuestion].add(faceId);
    console.log(`Recorded vote for Face ${faceId} on question ${currentQuestion + 1}. Total faces voted: ${faceVotesRef.current[currentQuestion].size}`);

    // Add vote to persistence
    const newVotes = dataService.addVote(currentQuestion, gesture);
    setVotes(newVotes);

    // Log analytics
    dataService.logAnalyticsEvent('gesture_detected', {
      questionId: currentQuestion,
      gesture,
      faceId,
      fps,
    });

    // Update session stats
    setSessionStats(dataService.getSessionStats());

    // Minority confetti logic
    const total = newVotes.yes + newVotes.no;
    if (total > 3) {
      const yesPct = newVotes.yes / total;
      const noPct = newVotes.no / total;
      if (yesPct < 0.25 || noPct < 0.25) {
        console.log('🎉 Minority opinion detected! Great discussion starter.');
        toast('Minority viewpoint detected! 🎉 This creates interesting discussions.');
      }
    }
    
    console.log(`Vote recorded: ${gesture.toUpperCase()} | Current totals - Yes: ${newVotes.yes}, No: ${newVotes.no}`);
  }, [currentQuestion, fps]);

  // -----------------------------------------
  // 2) Memoized Callback: handleFaceData
  // -----------------------------------------
  const handleFaceData = useCallback((faces: any[], currentFps: number) => {
    setDetectedFaces(faces);
    setFps(currentFps);
  }, []);

  const handleConflictPair = useCallback(() => {
    console.log('Conflict pair detected - opening discussion');
    toast('Matched with an opposite viewpoint! Join the discussion.');
    if (!isDiscussionOpen) {
      setIsDiscussionOpen(true);
    }
  }, [isDiscussionOpen]);

  // -----------------------------------------
  // Clear / Export data
  // -----------------------------------------
  const handleClearData = () => {
    if (confirm('Clear all session data? This will reset votes and statistics.')) {
      dataService.clearSessionData();
      setVotes({ yes: 0, no: 0 });
      setCurrentInfo(0);
      setCurrentQuestion(0);
      setSessionStats(dataService.getSessionStats());
      // Clear face vote tracking
      faceVotesRef.current = {};
      console.log('Session data cleared');
    }
  };

  const handleExportData = () => {
    const data = dataService.exportAnonymizedData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securematch_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('Data exported');
  };

  // Development helpers
  const handleTestVote = (gesture: 'yes' | 'no') => {
    // Use a negative face ID for test votes to distinguish from real faces
    const testFaceId = Math.floor(Math.random() * -1000);
    console.log(`Test vote: ${gesture} (Face ID: ${testFaceId})`);
    handleGestureDetected(gesture, testFaceId);
  };

  // -----------------------------------------
  // RENDER
  // -----------------------------------------
  return (
    <div className="min-h-screen bg-[#80319F] p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Card className="bg-black/50 px-4 py-2 inline-block border-0 shadow-none" style={{ marginTop: '-25px' }}>
            <h1 className="text-gray-200 text-4xl leading-relaxed text-center">
              SecureMatch
            </h1>
          </Card>
        </div>

        {/* Info Phase */}
        {phase === PHASES.INFO && (
          <Card className="bg-black/50 border-0 p-6 mb-8">
            <InfoDisplay
              info={SECURITY_INFOS[currentInfo]}
              timeRemainingInfo={timeRemainingInfo}
              infoDuration={Info_DURATION_MS / 1000}
            />
          </Card>
        )}

        {(phase === PHASES.QUESTION || phase === PHASES.RESULTS) && (
          <Card
            className="bg-black/50 border-0 p-6 mb-8 h-screen flex flex-col justify-start"
            style={{ minHeight: '60vh', maxHeight: '85vh' }}
          >
            {/* QuestionDisplay nur in Question-Phase */}
            {phase === PHASES.QUESTION && (
              <QuestionDisplay
                question={SECURITY_QUESTIONS[currentQuestion]}
                timeRemaining={timeRemaining}
                questionDuration={QUESTION_DURATION_MS / 1000}
              />
            )}

            {/* DiscussionCard nur in Results-Phase */}
            {phase === PHASES.RESULTS && (
              <div className="mt-6 mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6">
                  <Button
                    onClick={() => setIsDiscussionOpen(true)}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                    size="lg"
                  >
                    💬 Join Discussion
                  </Button>
                  <p className="text-gray-400 text-sm mt-2">
                    Talk to the person with the opposite opinion about ....!
                    Or anonymously stay in touch over the Chat by scanning the code!
                  </p>
                </div>
              </div>
            )}

            {/* WebcamFeed bleibt immer gemountet, Sichtbarkeit über Phase */}
            <div className="block mt-4">
              <WebcamFeed
                onGestureDetected={handleGestureDetected}
                onFaceData={handleFaceData}
                onConflictPair={handleConflictPair}
                fallbackMode={fallbackMode}
                debugMode={debugMode}
                questionId={currentQuestion}
              />
            </div>
          </Card>
        )}

        {/* Chat Interface Modal */}
        {isDiscussionOpen && (
          <ChatInterface
            question={SECURITY_QUESTIONS[currentQuestion]}
            onClose={() => setIsDiscussionOpen(false)}
          />
        )}
        <HelpDialog open={isHelpOpen} onOpenChange={setIsHelpOpen} />
      </div>
    </div>
  );
};

export default Index;