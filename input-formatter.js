/**
 * Created by ashwinikumar
 *     on 23/07/15.
 *
 */

(function (ng) {
	'use strict';

	var NUMBER_DIRECTIVE_NAME = 'number',
		CURRENCY_DIRECTIVE_NAME = 'currency',
		PERCENTAGE_DIRECTIVE_NAME = 'percentage',
		customRender = function (el, oldViewVal, newViewVal, ngModelCtrl, setCursor) {

			var start = el.selectionStart;
			var end = el.selectionEnd + newViewVal.length - oldViewVal.length;

			ngModelCtrl.$setViewValue(newViewVal);
			ngModelCtrl.$render();

			//if (setCursor)
			el.setSelectionRange(end, end);
		};

	ng.module('form.input.formatter', [])
		.filter('percentage', ['$window', '$filter', function ($window, $filter) {
			return function (sample, appender, precision) {
				if ((sample !== 0 && !sample) || (sample !== sample)) {
					return '';
				}

				appender = appender || '%';

				precision = ((precision || precision === 0) && isFinite(precision)) ? precision : 0;

				return $filter('number')(sample, precision) + '' + appender;
			};
		}])
		.directive('inputFormatter', ['$filter', '$browser', function ($filter, $browser) {

			return {
				require: 'ngModel',
				restrict: 'A',
				scope: true,
				link: function ($scope, $iElement, $iAttrs, ngModelCtrl) {

					var inputFormatterAttrs = $iAttrs.inputFormatter.split(':'),
						filterName, viewCleanerRegex,
						el = $iElement[0],
						placeHolder = $iAttrs.placeholder,
						allowNegative = $iAttrs.allowNegative,
						firstParam, secondParam, precisionParam, formatterParam, isFormatterPrefix;

					if (inputFormatterAttrs.length === 0) {
						return;
					}

					filterName = inputFormatterAttrs[0];
					firstParam = inputFormatterAttrs[1];
					secondParam = inputFormatterAttrs[2];

					if (filterName === NUMBER_DIRECTIVE_NAME) {
						precisionParam = parseInt(firstParam);
					} else if (filterName === CURRENCY_DIRECTIVE_NAME) {
						precisionParam = parseInt(secondParam);
						formatterParam = firstParam;
						isFormatterPrefix = true;
					} else if (filterName === PERCENTAGE_DIRECTIVE_NAME) {
						precisionParam = parseInt(secondParam);
						formatterParam = firstParam;
						isFormatterPrefix = false;
					} else {
						return;
					}

					if (precisionParam !== precisionParam) {
						precisionParam = 0;
					}

					if (precisionParam > 0) {
						//we should scrap all non-digit integers
						// and we should not scrap the last decimal point
						viewCleanerRegex = /[^0-9.]|\.(?=.*\.)/g;
					} else {
						//precision param provided implied is zero/negative
						//That case we should scrap all non-digit integers (including dots/decimals)
						viewCleanerRegex = /[^0-9]/g;
					}

					//Testing, if the user by mistake reverses the directive arguments
					//Like user paseed 'currency:2:$' in stead of 'currency:$:2'
					if (isFinite(formatterParam)) {
						throw new Error('Seems you have passed a number \'' + formatterParam +
							'\' as a prefix/suffix for showing in the view for formatting.');
					}

					ngModelCtrl.$parsers.push(function toModel(inputViewVal) {

						var cleanViewVal = inputViewVal,
							modelValue, formattedInputViewVal,
							inputViewValFormatterIndex,
							isInputViewValNegative,
							userEnteredPrecisionIncludingDot = 0,
							userEnteredPrecision = 0;

						//stripping the characters before and after the formatters as needed
						if (isFormatterPrefix === true) {
							inputViewValFormatterIndex = inputViewVal.indexOf(formatterParam);
							if (inputViewValFormatterIndex >= 0) {
								cleanViewVal = inputViewVal.substring(inputViewValFormatterIndex);
                                //case of `$-12.34`
                                isInputViewValNegative = (cleanViewVal.indexOf('-') === 1);
							}
                            else if (inputViewValFormatterIndex === -1) {
                                //case of `-12.34`
                                isInputViewValNegative = (cleanViewVal.indexOf('-') === 0);
                            }
						} else if (isFormatterPrefix === false) {
							inputViewValFormatterIndex = inputViewVal.lastIndexOf(formatterParam);
							if ((inputViewValFormatterIndex > 0) &&
								(inputViewValFormatterIndex < (inputViewVal.length - 1))) {
								cleanViewVal = inputViewVal.substring(0, inputViewValFormatterIndex);
							}
							//case of `-12.34%`
							isInputViewValNegative = (cleanViewVal.indexOf('-') === 0);
						}

						cleanViewVal = cleanViewVal.toString().replace(viewCleanerRegex, '');

						if (cleanViewVal.indexOf('.') !== -1) {
							userEnteredPrecisionIncludingDot = cleanViewVal.substring(
								cleanViewVal.indexOf('.')).length;
							userEnteredPrecision = userEnteredPrecisionIncludingDot - 1;

							//stripping the extra character, if any
							cleanViewVal = cleanViewVal.substring(0, cleanViewVal.indexOf('.') + precisionParam + 1);

						}

						if (userEnteredPrecisionIncludingDot === 1) {
							userEnteredPrecision = 1;
						}

						if (filterName === NUMBER_DIRECTIVE_NAME) {
							userEnteredPrecision = (userEnteredPrecision < precisionParam ?
								userEnteredPrecision : precisionParam);
							formattedInputViewVal = $filter(filterName)(cleanViewVal, userEnteredPrecision);
						} else if (filterName === CURRENCY_DIRECTIVE_NAME || filterName === PERCENTAGE_DIRECTIVE_NAME) {
							userEnteredPrecision = (userEnteredPrecision < precisionParam ?
								userEnteredPrecision : precisionParam);
							formattedInputViewVal = $filter(filterName)(cleanViewVal, firstParam, userEnteredPrecision);
						}

						if (userEnteredPrecisionIncludingDot === 1) {
							formattedInputViewVal = formattedInputViewVal.replace(/\.0/g, '.');
						} else if (cleanViewVal === '') {
							formattedInputViewVal = '';
						}

						modelValue = formattedInputViewVal.replace(viewCleanerRegex, '');

						if(isInputViewValNegative  && allowNegative) {
							modelValue = '-' + modelValue;

							if(isFormatterPrefix === true) {
								//case of `$12.34` ---> `$-12.34`
								formattedInputViewVal = formattedInputViewVal[0] + '-' +
									formattedInputViewVal.substring(1);
							}
							else if(isFormatterPrefix === false) {
								//case of `12.34%` ---> `-12.34%`
								formattedInputViewVal = '-' + formattedInputViewVal;
							}
						}

						if (precisionParam !== 0) {
							modelValue = parseFloat(modelValue);
						} else {
							modelValue = parseInt(modelValue);
						}

						modelValue = modelValue || 0;

						if (formattedInputViewVal === inputViewVal) {
							return modelValue;
						}

						//customRender(el, inputViewVal, formattedInputViewVal, ngModelCtrl, true);
						customRender(el, inputViewVal, formattedInputViewVal, ngModelCtrl);

						return modelValue;
					});

					ngModelCtrl.$formatters.push(function toView(modelValue) {

						//This whole functions tries to
						//translate the db-values to the input-view-values like
						//	3423.00 ---> `3,423` (for number and precision = any)
						//	3423.4300 ---> `$3,423.4` (for currency and precision = 1)
						//	3423.4300 ---> `3,423.43 %` (for percentage and precision = 2 or more)
						//	null ---> NaN ---> `0` (for number and precision = 0)
						//	undefined ---> NaN ---> `$0` (for currency and precision = 0)

						var viewValue,
							isModelNegative;

						if (precisionParam !== 0) {
							modelValue = parseFloat(modelValue);
						} else {
							modelValue = parseInt(modelValue);
						}

						//converting the integers and floats to string so that replace can be applied easily
						//NaN ---> '0'
						modelValue = modelValue ? modelValue.toString() : '0';

						if (modelValue === '0' && placeHolder) {
							return;
						}

						isModelNegative = (modelValue.indexOf('-') === 0);

						viewValue = $filter(filterName)(modelValue.replace(viewCleanerRegex, ''),
							firstParam, secondParam);

						//removing the insignificant zeros from the end
						// 	`$2,305.690` ---> `$2,305.69`, `20,345.69000 %` ---> `20,345.69 %`,
						// 	`345.609` ---> `345.609`, `2.00` --> `2`, `0.00` ---> `0`
						viewValue = viewValue.replace(/\.(\d*?)0+(\D*)$/g, function (m, grp1, grp2) {
							return (grp1.length > 0 ? '.' : '') + grp1 + grp2;
						});

						if(isModelNegative && allowNegative) {
							viewValue = '-' + viewValue;
						}

						//customRender(el, viewValue, modelValue, ngModelCtrl);

						return viewValue;
					});

					/*$iElement.on('copy', function() {

					});*/

					$iElement.on('paste cut', function () {
						$browser.defer(
							function () {
								angular.forEach(ngModelCtrl.$parsers, function (parser) {
									parser(ngModelCtrl.$viewValue);
								});
							}
						);
					});

				}
			};
		}]);
})(angular);
