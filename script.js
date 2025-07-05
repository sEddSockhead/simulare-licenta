// Use an IIFE for better encapsulation and to avoid global variable pollution
const ExamSimulator = (function() {
    // Constants for different modes
    const EXAM_MODE = 'exam';
    const PRACTICE_MODE = 'practice';
    const REVIEW_MODE = 'review';

    // DOM Element References (cached for performance)
    const elements = {
        // Status and Screen Containers
        loadingStatus: document.getElementById('loadingStatus'),
        errorStatus: document.getElementById('errorStatus'),
        successStatus: document.getElementById('successStatus'),
        startScreen: document.getElementById('startScreen'),
        categorySelectionScreen: document.getElementById('categorySelectionScreen'),
        examContainer: document.getElementById('examContainer'),
        resultsScreen: document.getElementById('resultsScreen'),

        // Buttons
        startBtn: document.getElementById('startBtn'),
        practiceBtn: document.getElementById('practiceBtn'),
        backToStartFromCategoryBtn: document.getElementById('backToStartFromCategoryBtn'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        finishExamBtn: document.getElementById('finishExamBtn'),
        restartExamBtn: document.getElementById('restartExamBtn'),
        reviewAnswersBtn: document.getElementById('reviewAnswersBtn'),
        goHomeBtn: document.getElementById('goHomeBtn'),
        
        // Category Selection
        categorySelectionGrid: document.getElementById('categorySelectionGrid'),

        // Exam Progress & Info
        questionNumber: document.getElementById('questionNumber'),
        totalQuestions: document.getElementById('totalQuestions'),
        answeredCount: document.getElementById('answeredCount'),
        currentScore: document.getElementById('currentScore'),
        maxScoreDisplay: document.getElementById('maxScoreDisplay'),
        timer: document.getElementById('timer'),
        progressFill: document.getElementById('progressFill'),
        progressBar: document.querySelector('.progress-bar'),

        // Question Display
        questionCategory: document.getElementById('questionCategory'),
        questionType: document.getElementById('questionType'),
        questionNumberDisplay: document.getElementById('questionNumberDisplay'),
        questionText: document.getElementById('questionText'),
        questionImageContainer: document.getElementById('questionImageContainer'),
        optionsContainer: document.getElementById('optionsContainer'),
        
        // Results Display
        resultsTitle: document.getElementById('resultsTitle'),
        finalScore: document.getElementById('finalScore'),
        passStatus: document.getElementById('passStatus'),
        categoryBreakdown: document.getElementById('categoryBreakdown')
    };

    // Centralized State Management
    const state = {
        questionsData: [],
        isQuestionsLoaded: false,
        currentExamQuestions: [],
        currentQuestionIndex: 0,
        userAnswers: [],
        currentScore: 0,
        timeLeft: 0,
        timerInterval: null,
        examMode: EXAM_MODE,
        practiceCategory: '',
        // Constants for exam rules
        EXAM_TOTAL_QUESTIONS: 90,
        EXAM_INITIAL_SCORE: 10,
        EXAM_PASS_SCORE: 60,
        EXAM_TIME_SECONDS: 180 * 60,
        ACC_FIN_QUESTIONS: 60,
        IT_QUESTIONS: 30,
    };

    // --- UTILITY AND SETUP FUNCTIONS ---

    // Utility function to escape HTML special characters
    function escapeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
    
    // Utility function to shuffle an array (Fisher-Yates algorithm)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // Utility function to show/hide screens by toggling a 'hidden' class
    function showScreen(screenId) {
        const screens = [elements.startScreen, elements.categorySelectionScreen, elements.examContainer, elements.resultsScreen];
        screens.forEach(screen => {
            screen.classList.toggle('hidden', screen.id !== screenId);
        });
    }

    // --- INITIALIZATION ---

    // Binds all event listeners to their respective DOM elements
    function bindEventListeners() {
        elements.startBtn.addEventListener('click', startExam);
        elements.practiceBtn.addEventListener('click', showCategorySelection);
        elements.backToStartFromCategoryBtn.addEventListener('click', goBackToStart);
        
        elements.prevBtn.addEventListener('click', previousQuestion);
        elements.nextBtn.addEventListener('click', nextQuestion);
        elements.finishExamBtn.addEventListener('click', () => {
             // The action of this button changes based on the mode
            if (state.examMode === REVIEW_MODE) {
                goBackToStart();
            } else {
                finishExam();
            }
        });

        elements.restartExamBtn.addEventListener('click', restartExam);
        elements.reviewAnswersBtn.addEventListener('click', reviewAnswers);
        elements.goHomeBtn.addEventListener('click', goBackToStart);
        
        window.addEventListener('beforeunload', (e) => {
            if (state.examMode === EXAM_MODE && state.timerInterval !== null) {
                e.preventDefault();
                e.returnValue = ''; // Required for historical reasons for some browsers
            }
        });
    }

    // Initialize the application on page load
    function init() {
        bindEventListeners();
        showScreen('startScreen'); // Set the initial view
        loadQuestionsFromFile();
    }
    
    // --- DATA LOADING AND VALIDATION ---

    // Validates a question object structure
    function validateQuestion(question, index) {
        if (!question.question || !Array.isArray(question.options) || question.options.length !== 4 || !['a', 'b', 'c', 'd'].includes(question.answer) || !question.category) {
            console.error(`Validation Error: Question at index ${index} has an invalid structure.`, question);
            return false;
        }
        return true;
    }

    // Loads questions from the JSON file
    async function loadQuestionsFromFile() {
        elements.loadingStatus.classList.remove('hidden');
        elements.errorStatus.classList.add('hidden');
        elements.successStatus.classList.add('hidden');
        elements.startBtn.disabled = true;
        elements.practiceBtn.disabled = true;

        try {
            const response = await fetch('intrebari-raspunsuri.json');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
            }
            const rawData = await response.json();
            
            state.questionsData = rawData.filter(validateQuestion);
            if (state.questionsData.length === 0) {
                throw new Error("No valid questions were found in the JSON file.");
            }

            state.isQuestionsLoaded = true;
            elements.successStatus.innerHTML = `✅ Încărcate ${state.questionsData.length} întrebări.`;
            elements.successStatus.classList.remove('hidden');
            elements.startBtn.disabled = false;
            elements.practiceBtn.disabled = false;
            console.log(`✅ Loaded ${state.questionsData.length} valid questions.`);

        } catch (error) {
            console.error('❌ Error loading JSON file:', error);
            elements.errorStatus.innerHTML = `❌ Nu s-a putut încărca fișierul "intrebari-raspunsuri.json".<br>
                <small>Detalii: ${escapeHTML(error.message)}</small>`;
            elements.errorStatus.classList.remove('hidden');
        } finally {
            elements.loadingStatus.classList.add('hidden');
        }
    }

    // --- QUESTION PREPARATION ---

    // Normalizes category names to handle inconsistencies
    function normalizeCategory(category) {
        const upperCategory = category.toUpperCase();
        if (upperCategory.includes('CONTABILITATE')) return 'CONTABILITATE FINANCIARA';
        if (upperCategory.includes('BAZE')) return 'BAZE DE DATE';
        if (upperCategory.includes('SISTEME INFORMATICE') || upperCategory.includes('SISTEME DE GESTIUNE')) return 'SISTEME INFORMATICE DE GESTIUNE';
        return upperCategory;
    }

    // Prepares questions for the full exam mode
    function prepareExamQuestions() {
        const contabilitateFinanciara = state.questionsData.filter(q => normalizeCategory(q.category) === 'CONTABILITATE FINANCIARA');
        const informaticaQuestions = state.questionsData.filter(q => ['BAZE DE DATE', 'SISTEME INFORMATICE DE GESTIUNE'].includes(normalizeCategory(q.category)));
        
        if (contabilitateFinanciara.length < state.ACC_FIN_QUESTIONS) throw new Error(`Insufficient questions for 'Contabilitate Financiară'. Found: ${contabilitateFinanciara.length}, Required: ${state.ACC_FIN_QUESTIONS}`);
        if (informaticaQuestions.length < state.IT_QUESTIONS) throw new Error(`Insufficient questions for 'Informatică'. Found: ${informaticaQuestions.length}, Required: ${state.IT_QUESTIONS}`);

        shuffleArray(contabilitateFinanciara);
        shuffleArray(informaticaQuestions);

        state.currentExamQuestions = [
            ...contabilitateFinanciara.slice(0, state.ACC_FIN_QUESTIONS),
            ...informaticaQuestions.slice(0, state.IT_QUESTIONS)
        ];
        shuffleArray(state.currentExamQuestions);
    }
    
    // Prepares questions for practice mode based on category
    function preparePracticeQuestions(category) {
        let filteredQuestions;
        if (category === 'CONTABILITATE FINANCIARA') {
            filteredQuestions = state.questionsData.filter(q => normalizeCategory(q.category) === 'CONTABILITATE FINANCIARA');
        } else if (category === 'INFORMATICA') {
            filteredQuestions = state.questionsData.filter(q => ['BAZE DE DATE', 'SISTEME INFORMATICE DE GESTIUNE'].includes(normalizeCategory(q.category)));
        } else {
            filteredQuestions = [...state.questionsData]; // Fallback
        }
        shuffleArray(filteredQuestions);
        state.currentExamQuestions = filteredQuestions;
    }
    
    // --- EXAM FLOW AND NAVIGATION ---
    
    // Starts the exam session
    function startExam() {
        if (!state.isQuestionsLoaded) { alert('Questions are not loaded yet.'); return; }
        
        elements.startBtn.innerHTML = '⏳ Pregătire...';
        elements.startBtn.disabled = true;

        try {
            state.examMode = EXAM_MODE;
            prepareExamQuestions();
            
            state.currentScore = state.EXAM_INITIAL_SCORE;
            state.userAnswers = new Array(state.currentExamQuestions.length).fill(null);
            state.currentQuestionIndex = 0;
            state.timeLeft = state.EXAM_TIME_SECONDS;

            elements.maxScoreDisplay.textContent = '100';
            elements.currentScore.textContent = state.currentScore;
            
            showScreen('examContainer');
            startTimer();
            displayQuestion();
            elements.questionText.focus();
        } catch (error) {
            alert(`Eroare la pornirea examenului: ${error.message}`);
            goBackToStart();
        } finally {
            elements.startBtn.innerHTML = '🚀 Începe Examenul';
            elements.startBtn.disabled = !state.isQuestionsLoaded;
        }
    }
    
    // Shows the category selection screen for practice mode
    function showCategorySelection() {
        if (!state.isQuestionsLoaded) { alert('Questions are not loaded yet.'); return; }
        
        elements.categorySelectionGrid.innerHTML = '';
        const categories = {
            'CONTABILITATE FINANCIARA': { name: 'Contabilitate Financiară', count: 0 },
            'INFORMATICA': { name: 'Informatică (Baze de Date + S.I.G.)', count: 0 }
        };

        state.questionsData.forEach(q => {
            const normalizedCat = normalizeCategory(q.category);
            if (normalizedCat === 'CONTABILITATE FINANCIARA') categories['CONTABILITATE FINANCIARA'].count++;
            if (['BAZE DE DATE', 'SISTEME INFORMATICE DE GESTIUNE'].includes(normalizedCat)) categories['INFORMATICA'].count++;
        });

        for (const catId in categories) {
            const cat = categories[catId];
            const card = document.createElement('div');
            card.className = 'category-selection-card';
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.innerHTML = `<h3>${escapeHTML(cat.name)}</h3><p>Întrebări: ${cat.count}</p>`;
            card.onclick = () => startPractice(catId);
            card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') startPractice(catId); };
            elements.categorySelectionGrid.appendChild(card);
        }
        
        showScreen('categorySelectionScreen');
    }

    // Starts a practice session for a specific category
    function startPractice(category) {
        state.examMode = PRACTICE_MODE;
        state.practiceCategory = category;
        preparePracticeQuestions(category);

        state.currentScore = 0;
        state.userAnswers = new Array(state.currentExamQuestions.length).fill(null);
        state.currentQuestionIndex = 0;
        
        elements.maxScoreDisplay.textContent = state.currentExamQuestions.length;
        elements.currentScore.textContent = state.currentScore;

        showScreen('examContainer');
        updateTimerDisplay(); // Shows 'PRACTICĂ' instead of a timer
        displayQuestion();
        elements.questionText.focus();
    }
    
    // Navigates back to the start screen
    function goBackToStart() {
        stopTimer();
        showScreen('startScreen');
        state.examMode = EXAM_MODE; // Reset mode to default
        elements.startBtn.disabled = !state.isQuestionsLoaded;
        elements.practiceBtn.disabled = !state.isQuestionsLoaded;
    }
    
    // Navigates to the next question or finishes the exam
    function nextQuestion() {
        if (state.currentQuestionIndex < state.currentExamQuestions.length - 1) {
            state.currentQuestionIndex++;
            displayQuestion();
            elements.questionText.focus();
        } else {
            finishExam();
        }
    }

    // Navigates to the previous question
    function previousQuestion() {
        if (state.currentQuestionIndex > 0) {
            state.currentQuestionIndex--;
            displayQuestion();
            elements.questionText.focus();
        }
    }
    
    // --- UI UPDATE FUNCTIONS ---

    // Displays the current question and its options
    function displayQuestion() {
        if (state.currentExamQuestions.length === 0) return;
        const question = state.currentExamQuestions[state.currentQuestionIndex];
        
        elements.questionNumber.textContent = state.currentQuestionIndex + 1;
        elements.totalQuestions.textContent = state.currentExamQuestions.length;
        elements.questionNumberDisplay.textContent = `Întrebarea ${state.currentQuestionIndex + 1} din ${state.currentExamQuestions.length}`;
        elements.questionText.innerHTML = escapeHTML(question.question);

        // Display category info
        const normalizedCat = normalizeCategory(question.category);
        elements.questionCategory.textContent = normalizedCat;
        elements.questionType.textContent = {
            'CONTABILITATE FINANCIARA': '📊 Contabilitate Financiară',
            'BAZE DE DATE': '🗄️ Baze de Date',
            'SISTEME INFORMATICE DE GESTIUNE': '💻 Sisteme Informatice de Gestiune'
        }[normalizedCat] || '';
        
        // Handle question image
        elements.questionImageContainer.innerHTML = '';
        if (question.image) {
            elements.questionImageContainer.innerHTML = `<img src="${question.image}" alt="Imagine pentru întrebare" class="question-image">`;
        }

        // Display options
        elements.optionsContainer.innerHTML = '';
        const answerLetterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
        const correctAnswerIndex = answerLetterMap[question.answer];
        const userAnswerIndex = state.userAnswers[state.currentQuestionIndex];
        const isAnswered = userAnswerIndex !== null;
        
        question.options.forEach((optionText, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.innerHTML = escapeHTML(optionText);
            optionDiv.setAttribute('role', 'radio');
            optionDiv.tabIndex = isAnswered ? -1 : 0;
            
            if (isAnswered) {
                optionDiv.classList.add('disabled');
                if (index === userAnswerIndex) optionDiv.classList.add('selected');
                if (index === correctAnswerIndex) optionDiv.classList.add('correct');
                if (index === userAnswerIndex && userAnswerIndex !== correctAnswerIndex) optionDiv.classList.add('incorrect');
            } else {
                optionDiv.onclick = () => selectAnswer(index);
                optionDiv.onkeydown = (e) => { if(e.key === 'Enter' || e.key === ' ') selectAnswer(index); };
            }
            elements.optionsContainer.appendChild(optionDiv);
        });

        updateProgress();
        updateNavigationButtons();
        updateAnsweredCount();
    }
    
    // Updates the state of navigation buttons
    function updateNavigationButtons() {
        elements.prevBtn.disabled = state.currentQuestionIndex === 0;
        elements.nextBtn.disabled = false;
        
        if (state.currentQuestionIndex === state.currentExamQuestions.length - 1) {
            elements.nextBtn.textContent = '🏁 Finalizează';
        } else {
            elements.nextBtn.textContent = 'Următoarea ➡';
        }
        
        // Configure middle button based on mode
        elements.finishExamBtn.classList.toggle('hidden', state.examMode === PRACTICE_MODE);
        if(state.examMode === REVIEW_MODE) {
            elements.finishExamBtn.textContent = '🏠 Acasă';
            elements.finishExamBtn.classList.remove('danger');
        } else {
            elements.finishExamBtn.textContent = '🏁 Finalizează Anticipat';
            elements.finishExamBtn.classList.add('danger');
        }
    }
    
    // Updates the progress bar
    function updateProgress() {
        const progress = ((state.currentQuestionIndex + 1) / state.currentExamQuestions.length) * 100;
        elements.progressFill.style.width = `${progress}%`;
        elements.progressBar.setAttribute('aria-valuenow', Math.round(progress));
    }
    
    // Updates the answered questions count
    function updateAnsweredCount() {
        const answeredCount = state.userAnswers.filter(answer => answer !== null).length;
        elements.answeredCount.textContent = answeredCount;
    }
    
    // Handles user's answer selection
    function selectAnswer(optionIndex) {
        if (state.userAnswers[state.currentQuestionIndex] !== null) return; // Already answered

        const question = state.currentExamQuestions[state.currentQuestionIndex];
        const answerLetterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
        const correctAnswerIndex = answerLetterMap[question.answer];
        
        state.userAnswers[state.currentQuestionIndex] = optionIndex;
        if (optionIndex === correctAnswerIndex) {
            state.currentScore += 1;
        }

        elements.currentScore.textContent = state.currentScore;
        displayQuestion(); // Re-render the question to show correct/incorrect state
    }
    
    // --- TIMER FUNCTIONS ---
    
    // Starts the exam timer
    function startTimer() {
        stopTimer(); // Clear any existing timer
        state.timerInterval = setInterval(() => {
            state.timeLeft--;
            if (state.timeLeft < 0) {
                stopTimer();
                alert('Timpul a expirat!');
                finishExam();
            } else {
                updateTimerDisplay();
            }
        }, 1000);
    }

    // Stops the exam timer
    function stopTimer() {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    
    // Updates the timer display
    function updateTimerDisplay() {
        const timerEl = elements.timer;
        if (state.examMode === EXAM_MODE && state.timerInterval) {
            const h = Math.floor(state.timeLeft / 3600);
            const m = Math.floor((state.timeLeft % 3600) / 60);
            const s = state.timeLeft % 60;
            timerEl.textContent = [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
            timerEl.classList.toggle('warning', state.timeLeft <= 600);
            timerEl.classList.toggle('danger', state.timeLeft <= 300);
        } else if (state.examMode === PRACTICE_MODE) {
            timerEl.textContent = 'PRACTICĂ';
            timerEl.className = 'timer';
        } else if (state.examMode === REVIEW_MODE) {
            timerEl.textContent = 'REVIZUIRE';
            timerEl.className = 'timer';
        }
    }

    // --- RESULTS AND REVIEW ---

    // Ends the exam and shows results
    function finishExam() {
        stopTimer();
        calculateFinalResults();
        showScreen('resultsScreen');
    }
    
    // Calculates the final results
    function calculateFinalResults() {
        let correctAnswers = 0;
        const answerLetterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
        state.currentExamQuestions.forEach((q, i) => {
            if (state.userAnswers[i] === answerLetterMap[q.answer]) correctAnswers++;
        });

        if (state.examMode === EXAM_MODE) {
            state.currentScore = state.EXAM_INITIAL_SCORE + correctAnswers;
            if (state.currentScore > 100) state.currentScore = 100;
        } else { // Practice mode
            state.currentScore = correctAnswers;
        }

        const maxScore = (state.examMode === EXAM_MODE) ? 100 : state.currentExamQuestions.length;
        elements.finalScore.textContent = `${state.currentScore}/${maxScore}`;

        if (state.examMode === EXAM_MODE) {
            const passed = state.currentScore >= state.EXAM_PASS_SCORE;
            elements.passStatus.textContent = passed ? '✅ PROMOVAT' : '❌ RESPINS';
            elements.passStatus.className = `pass-status ${passed ? 'pass' : 'fail'}`;
        } else {
            elements.passStatus.textContent = 'Mod Practică Terminat';
            elements.passStatus.className = 'pass-status';
        }
        
        displayCategoryBreakdown();
    }
    
    // Displays the category breakdown on the results screen
    function displayCategoryBreakdown() {
        const breakdown = {};
        const answerLetterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };

        state.currentExamQuestions.forEach((q, i) => {
            const cat = normalizeCategory(q.category);
            if (!breakdown[cat]) breakdown[cat] = { correct: 0, total: 0 };
            breakdown[cat].total++;
            if (state.userAnswers[i] === answerLetterMap[q.answer]) {
                breakdown[cat].correct++;
            }
        });

        elements.categoryBreakdown.innerHTML = '<h3>Defalcare pe Categorii:</h3>';
        for (const catName in breakdown) {
            const data = breakdown[catName];
            const percentage = data.total > 0 ? ((data.correct / data.total) * 100).toFixed(1) : 0;
            elements.categoryBreakdown.innerHTML += `<p>${catName}: ${data.correct}/${data.total} (${percentage}%)</p>`;
        }
    }
    
    // Restarts the exam or practice session
    function restartExam() {
        if (state.examMode === EXAM_MODE) {
            startExam();
        } else if (state.examMode === PRACTICE_MODE) {
            startPractice(state.practiceCategory);
        } else {
            goBackToStart();
        }
    }
    
    // Enters review mode to look over answers
    function reviewAnswers() {
        state.examMode = REVIEW_MODE;
        state.currentQuestionIndex = 0;
        showScreen('examContainer');
        updateTimerDisplay();
        displayQuestion();
    }

    // --- INITIALIZATION CALL ---
    window.addEventListener('load', init);

})();