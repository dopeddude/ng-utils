/**
 * Created by ashwinikumar on 23/07/15.
 * The directive purpose is to support the scenarios where we need to have different c
 * ontainment in the input-tag and the value stored against the model.
 * Usage:
 *		Dependency Registration
 *			var module = ng.module('your-module-name', ['form.input.formatter']);
 *		In HTML-Template (Either of the following)
 *			<input input-formatter="number" type="text" ng-model="your-model"/>
 *			<input input-formatter="number:3" type="text" ng-model="your-model"/>
 *			<input input-formatter="currency" type="text" ng-model="your-model"/>
 *			<input input-formatter="currency:£" type="text" ng-model="your-model"/>
 *			<input input-formatter="currency:$:2" type="text" ng-model="your-model"/>
 *			<input input-formatter="percentage:%" type="text" ng-model="your-model"/>
 *			<input input-formatter="percentage:#:2" type="text" ng-model="your-model"/>
 *
 *			This will throw the error saying
 *			"Seems you have passed a number '3' as a prefix/suffix for showing in the view for formatting."
 *			--- Cool 'Ehh...' ;-)
 *			<input input-formatter="percentage:3:%" type="text" ng-model="your-model"/>
 *
 * 	As per the convention I am prepending the currency symbol and appending the percentage symbol.
 *
 *	Existing Minor Issues
 *		The `,` can not be deleted manually inside the input box -- Which is fine for the formatted number
 *		Currently only `percentage`, `number` and `currency` filters are supported.
 *
 *
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

				return $filter('number')(sample, precision) + ' ' + appender;
			};
		}])
		.directive('inputFormatter1', ['$filter', function ($filter) {

			return {
				require: 'ngModel',
				restrict: 'A',
				scope: true,
				link: function ($scope, $iElement, $iAttrs, ngModelCtrl) {

					var inputFormatterAttrs = $iAttrs.inputFormatter1.split(':'),
						filterName, viewCleanerRegex,
						el = $iElement[0],
						firstParam, secondParam, precisionParam, formatterParam;

					if (inputFormatterAttrs.length === 0) {
						return;
					}

					filterName = inputFormatterAttrs[0];
					firstParam = inputFormatterAttrs[1];
					secondParam = inputFormatterAttrs[2];

					if (filterName === NUMBER_DIRECTIVE_NAME) {
						precisionParam = parseInt(firstParam);
					} else if (filterName === CURRENCY_DIRECTIVE_NAME || filterName === PERCENTAGE_DIRECTIVE_NAME) {
						precisionParam = parseInt(secondParam);
						formatterParam = firstParam;
					} else {
						return;
					}

					if(precisionParam !== precisionParam) {
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

					//Testing, if the user by mistake reverse the directive arguments
					//Like user paseed 'currency:2:$' in stead of 'currency:$:2'
					if (isFinite(formatterParam)) {
						throw new Error('Seems you have passed a number \'' + formatterParam +
							'\' as a prefix/suffix for showing in the view for formatting.');
					}

					ngModelCtrl.$parsers.push(function toModel(oldViewVal) {

						var cleanViewVal = oldViewVal.toString().replace(viewCleanerRegex, ''),
							modelValue, newViewVal,
							userFedPrecision,
							userEnteredPrecisionIncludingDot = 0, userEnteredPrecision = 0;

						if (cleanViewVal.indexOf('.') !== -1) {
							userEnteredPrecisionIncludingDot = cleanViewVal.substring(
								cleanViewVal.indexOf('.')).length;
							userEnteredPrecision = userEnteredPrecisionIncludingDot - 1;
						}

						if(userEnteredPrecisionIncludingDot === 1) {
							userEnteredPrecision = 1;
						}

						if (filterName === NUMBER_DIRECTIVE_NAME) {
							userFedPrecision = (userEnteredPrecision < precisionParam ?
								userEnteredPrecision : precisionParam);
							newViewVal = $filter(filterName)(cleanViewVal, userFedPrecision);
						} else if (filterName === CURRENCY_DIRECTIVE_NAME || filterName === PERCENTAGE_DIRECTIVE_NAME) {
							userFedPrecision = (userEnteredPrecision < precisionParam ?
								userEnteredPrecision : precisionParam);
							newViewVal = $filter(filterName)(cleanViewVal, firstParam, userFedPrecision);
						}

						if (newViewVal === oldViewVal) {
							return newViewVal;
						}

						if(userEnteredPrecisionIncludingDot === 1) {
							newViewVal = modelValue.replace(/\.0/g, '.');
						}
						else if(cleanViewVal === '') {
							newViewVal = '';
						}

						//customRender(el, oldViewVal, newViewVal, ngModelCtrl, true);
						customRender(el, oldViewVal, newViewVal, ngModelCtrl);

						modelValue = modelValue.replace(viewCleanerRegex, '');

						if (precisionParam !== 0) {
							modelValue = parseFloat(newViewVal);
						} else {
							modelValue = parseInt(newViewVal);
						}

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

						var viewValue;

						if (precisionParam !== 0) {
							modelValue = parseFloat(modelValue);
						} else {
							modelValue = parseInt(modelValue);
						}

						//converting the integers and floats to string so that replace can be applied easily
						//NaN ---> '0'
						modelValue = modelValue ? modelValue.toString() : '0';

						viewValue = $filter(filterName)(modelValue.replace(viewCleanerRegex, ''),
							firstParam, secondParam);

						//removing the insignificant zeros from the end
						// 	`$2,305.690` ---> `$2,305.69`, `20,345.69000 %` ---> `20,345.69 %`,
						// 	`345.609` ---> `345.609`, `2.00` --> `2`, `0.00` ---> `0`
						viewValue = viewValue.replace(/\.(\d*?)0+(\D*)$/g, function(m, grp1, grp2) {
							return (grp1.length > 0 ? "." : "") + grp1 + grp2;
						});

						//customRender(el, viewValue, modelValue, ngModelCtrl);

						return viewValue;
					});
				}
			};
		}]);
})(angular);