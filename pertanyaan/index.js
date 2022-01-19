const umum = require('./umum');
const sport = require('./sport');
// const olahraga = require('./olahraga');
// const movie = require('./movie');

const getQuestionsByCategory = (category) => {
    switch(category){
        case 'umum' : return umum; break;
        // case 'olahra' : return olahraga; break;
        // case 'movie' : return movie; break;
        case 'sport' : return sport; break;
        default : return umum; break;
    }
} 

const getCurrentQuestion = (questions) => {
    const qLength = questions?.length - 1;
    const randIdx = Math.round(Math.random() * qLength);
    if(questions[randIdx]?.isPassed){
        return getCurrentQuestion(questions)
    }
    return questions[randIdx];
}

const getAnswer = (question, answer) => {
    return question.key === answer
}

module.exports = {
    getQuestionsByCategory,
    getCurrentQuestion,
    getAnswer
}