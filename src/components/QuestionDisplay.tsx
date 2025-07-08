import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QuestionDisplayProps {
  question: string;
  //questionIndex: number;
  //totalQuestions: number;
  timeRemaining: number;
  questionDuration: number;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  //questionIndex,
  //totalQuestions,
  timeRemaining,
  questionDuration,
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        {/* <h3 className="text-xl font-semibold text-white text-center flex-1">
          Current Question
        </h3> */}
        {/* <Badge
          variant="outline"
          className="text-blue-400 border-blue-400 ml-4 shrink-0"
        >
          {questionIndex} / {totalQuestions}
        </Badge> */}
      </div>

      <div className="flex justify-center items-center text-xs text-gray-400"
        style={{ marginTop: '-50px' }}//style={{ marginTop: '-50px' }}
      >
        {/* <span>Time left: {timeRemaining} seconds</span> */}
        {/* <div className="flex gap-2 items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live</span>
        </div> */}
      </div>
      <div className="mt-2 mb-8 w-full bg-gray-700 rounded-full h-1">
        <div
          className="bg-yellow-400 h-1 rounded-full transition-all duration-1000"
          style={{ width: `${((questionDuration - timeRemaining) / questionDuration) * 100}%` }}
        ></div>
      </div>

      <div className="mb-8 mt-20">
        <p className="text-gray-200 text-4xl leading-relaxed text-center">
          {question}
        </p>
      </div>

      {/* <div className="mt-4 w-full bg-gray-700 rounded-full h-1">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-1 rounded-full transition-all duration-300"
          style={{ width: `${(questionIndex / totalQuestions) * 100}%` }}
        ></div>
      </div> */}
    </div>
  );
};

export default QuestionDisplay;
