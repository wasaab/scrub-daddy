const { SummaryFormatter, formatterHelpers, Status } = require('cucumber');

class InlineFormatter extends SummaryFormatter {
  constructor(options) {
    super(options);

    options.eventBroadcaster.on('test-step-started', (stepData) => {
      this.logTestStepStarted(stepData);
    });
    options.eventBroadcaster.on('test-step-finished', () => this.log('\n'));
  }

  logTestStepStarted(stepData) {
    const testCaseAttempt = this.eventDataCollector.getTestCaseAttempt(stepData.testCase);
    const { gherkinDocument, pickle, testCase } = testCaseAttempt;
    const stepLineToKeywordMap = formatterHelpers.GherkinDocumentParser.getStepLineToKeywordMap(gherkinDocument);
    const stepLineToPickledStepMap = formatterHelpers.PickleParser.getStepLineToPickledStepMap(pickle);
    const testStep = testCase.steps[stepData.index];

    if (!testStep.sourceLocation) { return; }

    const stepText = this.buildStepText(stepLineToPickledStepMap, testStep, stepLineToKeywordMap);

    this.log(this.colorFns[Status.SKIPPED](stepText));
  }

  buildStepText(stepLineToPickledStepMap, testStep, stepLineToKeywordMap) {
    const pickleStep = stepLineToPickledStepMap[testStep.sourceLocation.line];
    const keyword = formatterHelpers.PickleParser.getStepKeyword({
      pickleStep: pickleStep,
      stepLineToKeywordMap: stepLineToKeywordMap
    });
    const separator = 'Given ' === keyword ? `${'-'.repeat(100)}\n\n` : '';
    const stepText = `${separator}${keyword}${pickleStep.text}\n`;

    return stepText;
  }
}

module.exports = InlineFormatter;