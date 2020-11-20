/*!
 * © 2020 Atypon Systems LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export const convertMathMLToSVG = async (
  mathml: string,
  display: boolean
): Promise<string | null> => {
  const { convertMathMLToSVG } = await import('./mathml-to-svg')

  return convertMathMLToSVG(mathml, display)
}

export const convertTeXToMathML = async (
  tex: string,
  display: boolean
): Promise<string | null> => {
  const { convertTeXToMathML } = await import('./tex-to-mathml')

  return convertTeXToMathML(tex, display)
}

export const convertTeXToSVG = async (
  tex: string,
  display: boolean
): Promise<string | null> => {
  const { convertTeXToSVG } = await import('./tex-to-svg')

  return convertTeXToSVG(tex, display)
}
